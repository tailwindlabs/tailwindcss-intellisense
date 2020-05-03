import { TextDocument, Position } from 'vscode-languageserver'
import { isHtmlDoc, isInsideTag, isVueDoc, isSvelteDoc } from './html'

export const JS_LANGUAGES = [
  'javascript',
  'javascriptreact',
  'reason',
  'typescriptreact',
]

export function isJsDoc(doc: TextDocument): boolean {
  return JS_LANGUAGES.indexOf(doc.languageId) !== -1
}

export function isJsContext(doc: TextDocument, position: Position): boolean {
  if (isJsDoc(doc)) {
    return true
  }

  let str = doc.getText({
    start: { line: 0, character: 0 },
    end: position,
  })

  if (isHtmlDoc(doc) && isInsideTag(str, ['script'])) {
    return true
  }

  if (isVueDoc(doc) || isSvelteDoc(doc)) {
    return isInsideTag(str, ['script'])
  }

  return false
}
