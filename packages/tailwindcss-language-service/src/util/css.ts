import type { Position } from 'vscode-languageserver'
import type { TextDocument } from 'vscode-languageserver-textdocument'
import { isVueDoc, isSvelteDoc, isHtmlDoc } from './html'
import { isJsDoc } from './js'
import type { State } from './state'
import { cssLanguages } from './languages'
import { getLanguageBoundaries } from './getLanguageBoundaries'

function getCssLanguages(state: State): string[] {
  const userCssLanguages = Object.keys(state.editor.userLanguages).filter((lang) =>
    cssLanguages.includes(state.editor.userLanguages[lang]),
  )

  return [...cssLanguages, ...userCssLanguages]
}

export function isCssLanguage(state: State, lang: string): boolean {
  return getCssLanguages(state).indexOf(lang) !== -1
}

export function isCssDoc(state: State, doc: TextDocument): boolean {
  return isCssLanguage(state, doc.languageId)
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
