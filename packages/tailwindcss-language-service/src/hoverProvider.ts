import type { State } from './util/state'
import type { Hover, MarkupContent, Position, Range } from 'vscode-languageserver'
import { stringifyCss, stringifyConfigValue } from './util/stringify'
import dlv from 'dlv'
import { isCssContext } from './util/css'
import {
  findAll,
  findClassNameAtPosition,
  findHelperFunctionsInRange,
  indexToPosition,
} from './util/find'
import { validateApply } from './util/validateApply'
import { getClassNameParts } from './util/getClassNameAtPosition'
import * as jit from './util/jit'
import { validateConfigPath } from './diagnostics/getInvalidConfigPathDiagnostics'
import { isWithinRange } from './util/isWithinRange'
import type { TextDocument } from 'vscode-languageserver-textdocument'
import { addPixelEquivalentsToValue } from './util/pixelEquivalents'
import { getTextWithoutComments } from './util/doc'
import braces from 'braces'
import { absoluteRange } from './util/absoluteRange'
import { segment } from './util/segment'

export async function doHover(
  state: State,
  document: TextDocument,
  position: Position,
): Promise<Hover> {
  return (
    (await provideClassNameHover(state, document, position)) ||
    (await provideThemeDirectiveHover(state, document, position)) ||
    (await provideCssHelperHover(state, document, position)) ||
    (await provideSourceGlobHover(state, document, position))
  )
}

async function provideCssHelperHover(
  state: State,
  document: TextDocument,
  position: Position,
): Promise<Hover> {
  if (!isCssContext(state, document, position)) {
    return null
  }

  const settings = await state.editor.getConfiguration(document.uri)

  let helperFns = findHelperFunctionsInRange(document, {
    start: { line: position.line, character: 0 },
    end: { line: position.line + 1, character: 0 },
  })

  for (let helperFn of helperFns) {
    if (!isWithinRange(position, helperFn.ranges.path)) continue

    if (helperFn.helper === 'var' && !state.v4) continue

    let validated = validateConfigPath(
      state,
      helperFn.path,
      helperFn.helper === 'theme' ? ['theme'] : [],
    )

    // This property may not exist in the state object because of compatibility with Tailwind Play
    let value = validated.isValid ? stringifyConfigValue(validated.value) : null
    if (value === null) return null

    if (settings.tailwindCSS.showPixelEquivalents) {
      value = addPixelEquivalentsToValue(value, settings.tailwindCSS.rootFontSize)
    }

    let lines = ['```plaintext', value, '```']

    if (state.v4 && helperFn.path.startsWith('--')) {
      lines = [
        //
        '```css',
        '@theme {',
        `  ${helperFn.path}: ${value};`,
        '}',
        '```',
      ]
    }

    return {
      contents: { kind: 'markdown', value: lines.join('\n') },
      range: helperFn.ranges.path,
    }
  }

  return null
}

async function provideClassNameHover(
  state: State,
  document: TextDocument,
  position: Position,
): Promise<Hover> {
  let className = await findClassNameAtPosition(state, document, position)
  if (className === null) return null

  if (state.v4) {
    let root = state.designSystem.compile([className.className])[0]

    if (root.nodes.length === 0) {
      return null
    }

    return {
      contents: {
        language: 'css',
        value: await jit.stringifyRoot(state, root, document.uri),
      },
      range: className.range,
    }
  }

  if (state.jit) {
    let { root, rules } = jit.generateRules(state, [className.className])

    if (rules.length === 0) {
      return null
    }

    return {
      contents: {
        language: 'css',
        value: await jit.stringifyRoot(state, root, document.uri),
      },
      range: className.range,
    }
  }

  const parts = getClassNameParts(state, className.className)
  if (!parts) return null

  if (isCssContext(state, document, position)) {
    let validated = validateApply(state, parts)
    if (validated === null || validated.isApplyable === false) {
      return null
    }
  }

  const settings = await state.editor.getConfiguration(document.uri)

  const css = stringifyCss(
    className.className,
    dlv(state.classNames.classNames, [...parts, '__info']),
    settings,
  )

  if (!css) return null

  return {
    contents: {
      language: 'css',
      value: css,
    },
    range: className.range,
  }
}

function markdown(lines: string[]): MarkupContent {
  return {
    kind: 'markdown',
    value: lines.join('\n'),
  }
}

async function provideSourceGlobHover(
  state: State,
  document: TextDocument,
  position: Position,
): Promise<Hover> {
  if (!isCssContext(state, document, position)) {
    return null
  }

  let range = {
    start: { line: position.line, character: 0 },
    end: { line: position.line + 1, character: 0 },
  }

  let text = getTextWithoutComments(document, 'css', range)

  let patterns = [
    /@source(?:\s+not)?\s*(?<glob>'[^']+'|"[^"]+")/dg,
    /@source(?:\s+not)?\s*inline\((?<glob>'[^']+'|"[^"]+")/dg,
  ]

  let matches = patterns.flatMap((pattern) => findAll(pattern, text))

  for (let match of matches) {
    let glob = match.groups.glob.slice(1, -1)

    // Ignore globs that don't need brace expansion
    if (!glob.includes('{') || !glob.includes('}')) continue

    // Ignore glob that don't contain the current position
    let slice: Range = absoluteRange(
      {
        start: indexToPosition(text, match.indices.groups.glob[0]),
        end: indexToPosition(text, match.indices.groups.glob[1]),
      },
      range,
    )

    if (!isWithinRange(position, slice)) continue

    // Perform brace expansion
    let expanded = new Set(braces.expand(glob))
    if (expanded.size < 2) continue

    return {
      range: slice,
      contents: markdown([
        //
        '**Expansion**',
        '```plaintext',
        ...Array.from(expanded, (entry) => `- ${entry}`),
        '```',
      ]),
    }
  }

  return null
}

// Provide completions for directives that take file paths
const PATTERN_AT_THEME = /@(?<directive>theme)\s+(?<parts>[^{]+)\s*\{/dg
const PATTERN_IMPORT_THEME = /@(?<directive>import)\s*[^;]+?theme\((?<parts>[^)]+)\)/dg

async function provideThemeDirectiveHover(
  state: State,
  document: TextDocument,
  position: Position,
): Promise<Hover> {
  if (!state.v4) return null

  let range = {
    start: { line: position.line, character: 0 },
    end: { line: position.line + 1, character: 0 },
  }

  let text = getTextWithoutComments(document, 'css', range)

  let matches = [...findAll(PATTERN_IMPORT_THEME, text), ...findAll(PATTERN_AT_THEME, text)]

  for (let match of matches) {
    let directive = match.groups.directive
    let parts = match.groups.parts

    // Find the option under the cursor
    let options: { name: string; range: Range }[] = []

    let offset = match.indices.groups.parts[0]

    for (let part of segment(parts, ' ')) {
      let length = part.length
      part = part.trim()

      if (part !== '') {
        options.push({
          name: part,
          range: absoluteRange(
            {
              start: indexToPosition(text, offset),
              end: indexToPosition(text, offset + part.length),
            },
            range,
          ),
        })
      }

      offset += length + 1
    }

    let option = options.find((option) => isWithinRange(position, option.range))
    if (!option) return null

    let markdown = getThemeMarkdown(directive, option.name)
    if (!markdown) return null

    return {
      range: option.range,
      contents: markdown,
    }
  }

  return null
}

function getThemeMarkdown(directive: string, name: string) {
  let options = {
    reference: markdown([
      directive === 'import'
        ? `Don't emit CSS variables for imported theme values.`
        : `Don't emit CSS variables for these theme values.`,
    ]),

    inline: markdown([
      directive === 'import'
        ? `Inline imported theme values into generated utilities instead of using \`var(…)\`.`
        : `Inline these theme values into generated utilities instead of using \`var(…)\`.`,
    ]),

    static: markdown([
      directive === 'import'
        ? `Always emit imported theme values into the CSS file instead of only when used.`
        : `Always emit these theme values into the CSS file instead of only when used.`,
    ]),

    default: markdown([
      directive === 'import'
        ? `Allow imported theme values to be overridden by JS configs and plugins.`
        : `Allow these theme values to be overridden by JS configs and plugins.`,
    ]),
  }

  return options[name]
}
