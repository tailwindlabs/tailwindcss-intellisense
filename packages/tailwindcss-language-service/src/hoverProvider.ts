import { State } from './util/state'
import type { Hover, TextDocument, Position } from 'vscode-languageserver'
import { stringifyCss, stringifyConfigValue } from './util/stringify'
const dlv = require('dlv')
import { isCssContext } from './util/css'
import { findClassNameAtPosition } from './util/find'
import { validateApply } from './util/validateApply'
import { getClassNameParts } from './util/getClassNameAtPosition'
import { getDocumentSettings } from './util/getDocumentSettings'

export async function doHover(
  state: State,
  document: TextDocument,
  position: Position
): Promise<Hover> {
  return (
    (await provideClassNameHover(state, document, position)) ||
    provideCssHelperHover(state, document, position)
  )
}

function provideCssHelperHover(
  state: State,
  document: TextDocument,
  position: Position
): Hover {
  if (!isCssContext(state, document, position)) return null

  const line = document.getText({
    start: { line: position.line, character: 0 },
    end: { line: position.line + 1, character: 0 },
  })

  const match = line.match(
    /(?<helper>theme|config)\((?<quote>['"])(?<key>[^)]+)\k<quote>\)/
  )

  if (match === null) return null

  const startChar = match.index + match.groups.helper.length + 2
  const endChar = startChar + match.groups.key.length

  if (position.character < startChar || position.character >= endChar) {
    return null
  }

  let key = match.groups.key
    .split(/(\[[^\]]+\]|\.)/)
    .filter(Boolean)
    .filter((x) => x !== '.')
    .map((x) => x.replace(/^\[([^\]]+)\]$/, '$1'))

  if (key.length === 0) return null

  if (match.groups.helper === 'theme') {
    key = ['theme', ...key]
  }

  const value = stringifyConfigValue(dlv(state.config, key))

  if (value === null) return null

  return {
    contents: { kind: 'plaintext', value },
    range: {
      start: { line: position.line, character: startChar },
      end: {
        line: position.line,
        character: endChar,
      },
    },
  }
}

async function provideClassNameHover(
  state: State,
  document: TextDocument,
  position: Position
): Promise<Hover> {
  let className = await findClassNameAtPosition(state, document, position)
  if (className === null) return null

  const parts = getClassNameParts(state, className.className)
  if (!parts) return null

  if (isCssContext(state, document, position)) {
    let validated = validateApply(state, parts)
    if (validated === null || validated.isApplyable === false) {
      return null
    }
  }

  const settings = await getDocumentSettings(state, document)

  const css = stringifyCss(
    className.className,
    dlv(state.classNames.classNames, [...parts, '__info']),
    {
      tabSize: dlv(settings, 'tabSize', 2),
      showPixelEquivalents: dlv(settings, 'showPixelEquivalents', true),
      rootFontSize: dlv(settings, 'rootFontSize', 16),
    }
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
