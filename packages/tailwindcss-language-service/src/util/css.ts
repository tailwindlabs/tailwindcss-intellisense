import type { Position } from 'vscode-languageserver'
import type { TextDocument } from 'vscode-languageserver-textdocument'
import { isVueDoc, isSvelteDoc, isHtmlDoc } from './html'
import { isJsDoc } from './js'
import { State } from './state'
import { cssLanguages } from './languages'
import { getLanguageBoundaries } from './getLanguageBoundaries'

export function isCssDoc(state: State, doc: TextDocument): boolean {
  const userCssLanguages = Object.keys(state.editor.userLanguages).filter((lang) =>
    cssLanguages.includes(state.editor.userLanguages[lang])
  )

  return [...cssLanguages, ...userCssLanguages].indexOf(doc.languageId) !== -1
}

export function isCssContext(state: State, doc: TextDocument, position: Position): boolean {
  if (isCssDoc(state, doc)) {
    return true
  }

  if (isHtmlDoc(state, doc) || isVueDoc(doc) || isSvelteDoc(doc) || isJsDoc(state, doc)) {
    let str = doc.getText({
      start: { line: 0, character: 0 },
      end: position,
    })

    let boundaries = getLanguageBoundaries(state, doc, str)

    return boundaries ? boundaries[boundaries.length - 1].type === 'css' : false
  }

  return false
}
