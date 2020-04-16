import { TextDocument, Position } from 'vscode-languageserver'
import { isInsideTag, isVueDoc, isSvelteDoc } from './html'

export const CSS_LANGUAGES = [
  'css',
  'less',
  'postcss',
  'sass',
  'scss',
  'stylus',
]

function isCssDoc(doc: TextDocument): boolean {
  return CSS_LANGUAGES.indexOf(doc.languageId) !== -1
}

export function isCssContext(doc: TextDocument, position: Position): boolean {
  if (isCssDoc(doc)) {
    return true
  }

  if (isVueDoc(doc) || isSvelteDoc(doc)) {
    let str = doc.getText({
      start: { line: 0, character: 0 },
      end: position,
    })

    return isInsideTag(str, ['style'])
  }

  return false
}
