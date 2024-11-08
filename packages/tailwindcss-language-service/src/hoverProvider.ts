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

export async function doHover(
  state: State,
  document: TextDocument,
  position: Position,
): Promise<Hover> {
  return (
    (await provideClassNameHover(state, document, position)) ||
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

    let validated = validateConfigPath(
      state,
      helperFn.path,
      helperFn.helper === 'theme' ? ['theme'] : [],
    )

    // This property may not exist in the state object because of compatability with Tailwind Play
    let value = validated.isValid ? stringifyConfigValue(validated.value) : null
    if (value === null) return null

    if (settings.tailwindCSS.showPixelEquivalents) {
      value = addPixelEquivalentsToValue(value, settings.tailwindCSS.rootFontSize)
    }

    return {
      contents: { kind: 'markdown', value: ['```plaintext', value, '```'].join('\n') },
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

  let pattern = /@source\s*(?<path>'[^']+'|"[^"]+")/dg

  for (let match of findAll(pattern, text)) {
    let path = match.groups.path.slice(1, -1)

    // Ignore paths that don't need brace expansion
    if (!path.includes('{') || !path.includes('}')) continue

    // Ignore paths that don't contain the current position
    let slice: Range = absoluteRange(
      {
        start: indexToPosition(text, match.indices.groups.path[0]),
        end: indexToPosition(text, match.indices.groups.path[1]),
      },
      range,
    )

    if (!isWithinRange(position, slice)) continue

    // Perform brace expansion
    let paths = new Set(braces.expand(path))
    if (paths.size < 2) continue

    return {
      range: slice,
      contents: markdown([
        //
        '**Expansion**',
        '```plaintext',
        ...Array.from(paths, (path) => `- ${path}`),
        '```',
      ]),
    }
  }

  return null
}
