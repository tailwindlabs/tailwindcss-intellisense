import { State } from '../util/state'
import { Hover, TextDocumentPositionParams } from 'vscode-languageserver'
import { stringifyCss, stringifyConfigValue } from '../util/stringify'
const dlv = require('dlv')
import { isCssContext } from '../util/css'
import { findClassNameAtPosition } from '../util/find'
import { validateApply } from '../util/validateApply'
import { getClassNameParts } from '../util/getClassNameAtPosition'

export function provideHover(
  state: State,
  params: TextDocumentPositionParams
): Hover {
  return (
    provideClassNameHover(state, params) || provideCssHelperHover(state, params)
  )
}

function provideCssHelperHover(
  state: State,
  { textDocument, position }: TextDocumentPositionParams
): Hover {
  let doc = state.editor.documents.get(textDocument.uri)

  if (!isCssContext(state, doc, position)) return null

  const line = doc.getText({
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

function provideClassNameHover(
  state: State,
  { textDocument, position }: TextDocumentPositionParams
): Hover {
  let doc = state.editor.documents.get(textDocument.uri)

  let className = findClassNameAtPosition(state, doc, position)
  if (className === null) return null

  const parts = getClassNameParts(state, className.className)
  if (!parts) return null

  if (isCssContext(state, doc, position)) {
    let validated = validateApply(state, parts)
    if (validated === null || validated.isApplyable === false) {
      return null
    }
  }

  return {
    contents: {
      language: 'css',
      value: stringifyCss(
        className.className,
        dlv(state.classNames.classNames, parts)
      ),
    },
    range: className.range,
  }
}
