import type { TextDocument, Position } from 'vscode-languageserver'
import { isHtmlDoc, isInsideTag, isVueDoc, isSvelteDoc } from './html'
import { State } from './state'
import { jsLanguages } from './languages'

export function isJsDoc(state: State, doc: TextDocument): boolean {
  const userJsLanguages = Object.keys(state.editor.userLanguages).filter((lang) =>
    jsLanguages.includes(state.editor.userLanguages[lang])
  )

  return [...jsLanguages, ...userJsLanguages].indexOf(doc.languageId) !== -1
}

export function isJsContext(state: State, doc: TextDocument, position: Position): boolean {
  if (isJsDoc(state, doc)) {
    return true
  }

  let str = doc.getText({
    start: { line: 0, character: 0 },
    end: position,
  })

  if (isHtmlDoc(state, doc) && isInsideTag(str, ['script'])) {
    return true
  }

  if (isVueDoc(doc) || isSvelteDoc(doc)) {
    return isInsideTag(str, ['script'])
  }

  return false
}
