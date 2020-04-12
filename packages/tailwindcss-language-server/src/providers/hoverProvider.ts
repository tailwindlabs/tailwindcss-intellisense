import { State } from '../util/state'
import { Hover, TextDocumentPositionParams } from 'vscode-languageserver'
import {
  getClassNameAtPosition,
  getClassNameParts,
} from '../util/getClassNameAtPosition'
import { stringifyCss } from '../util/stringify'
const dlv = require('dlv')
import escapeClassName from 'css.escape'
import { isHtmlContext } from '../util/html'

export function provideHover(
  state: State,
  params: TextDocumentPositionParams
): Hover {
  let doc = state.editor.documents.get(params.textDocument.uri)

  if (isHtmlContext(doc, params.position)) {
    return provideClassNameHover(state, params)
  }

  return null
}

function provideClassNameHover(
  state: State,
  { textDocument, position }: TextDocumentPositionParams
): Hover {
  let doc = state.editor.documents.get(textDocument.uri)
  let hovered = getClassNameAtPosition(doc, position)
  if (!hovered) return null

  const parts = getClassNameParts(state, hovered.className)
  if (parts === null) return null

  return {
    contents: {
      language: 'css',
      value: stringifyCss(dlv(state.classNames.classNames, parts), {
        selector: augmentClassName(parts, state),
      }),
    },
    range: hovered.range,
  }
}

// TODO
function augmentClassName(className: string | string[], state: State): string {
  const parts = Array.isArray(className)
    ? className
    : getClassNameParts(state, className)
  const obj = dlv(state.classNames.classNames, parts)
  const pseudo = obj.__pseudo ? obj.__pseudo.join('') : ''
  const scope = obj.__scope ? `${obj.__scope} ` : ''
  return `${scope}.${escapeClassName(parts.join(state.separator))}${pseudo}`
}
