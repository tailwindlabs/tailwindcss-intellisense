import type { State } from './util/state'
import type { Hover, Position } from 'vscode-languageserver'
import { stringifyCss, stringifyConfigValue } from './util/stringify'
import dlv from 'dlv'
import { isCssContext } from './util/css'
import { findClassNameAtPosition, findHelperFunctionsInRange } from './util/find'
import { validateApply } from './util/validateApply'
import { getClassNameParts } from './util/getClassNameAtPosition'
import * as jit from './util/jit'
import { validateConfigPath } from './diagnostics/getInvalidConfigPathDiagnostics'
import { isWithinRange } from './util/isWithinRange'
import type { TextDocument } from 'vscode-languageserver-textdocument'

export async function doHover(
  state: State,
  document: TextDocument,
  position: Position,
): Promise<Hover> {
  return (
    (await provideClassNameHover(state, document, position)) ||
    (await provideCssHelperHover(state, document, position))
  )
}

async function provideCssHelperHover(state: State, document: TextDocument, position: Position): Promise<Hover> {
  if (!isCssContext(state, document, position)) {
    return null
  }

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
