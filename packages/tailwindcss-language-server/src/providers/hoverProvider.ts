import { State } from '../util/state'
import { Hover, TextDocumentPositionParams } from 'vscode-languageserver'
import {
  getClassNameAtPosition,
  getClassNameParts,
} from '../util/getClassNameAtPosition'
import { stringifyCss, stringifyConfigValue } from '../util/stringify'
const dlv = require('dlv')
import { isHtmlContext } from '../util/html'
import { isCssContext } from '../util/css'

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

  if (!isCssContext(doc, position)) return null

  const line = doc.getText({
    start: { line: position.line, character: 0 },
    end: { line: position.line + 1, character: 0 },
  })

  const match = line.match(
    /(?<helper>theme|config)\((?<quote>['"])(?<key>[^)]+)\k<quote>\)/
  )

  if (match === null) return null

  const startChar = match.index + 7
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

  if (!isHtmlContext(doc, position)) return null

  let hovered = getClassNameAtPosition(doc, position)
  if (!hovered) return null

  const parts = getClassNameParts(state, hovered.className)
  if (parts === null) return null

  return {
    contents: {
      language: 'css',
      value: stringifyCss(
        hovered.className,
        dlv(state.classNames.classNames, parts)
      ),
    },
    range: hovered.range,
  }
}
