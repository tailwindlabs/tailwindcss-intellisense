import type { TextDocument, Position } from 'vscode-languageserver'
import { isInsideTag, isVueDoc, isSvelteDoc, isHtmlDoc } from './html'
import { State } from './state'

export const CSS_LANGUAGES = [
  'css',
  'less',
  'postcss',
  'sass',
  'scss',
  'stylus',
  'sugarss',
]

export function isCssDoc(state: State, doc: TextDocument): boolean {
  const userCssLanguages = Object.keys(
    state.editor.userLanguages
  ).filter((lang) => CSS_LANGUAGES.includes(state.editor.userLanguages[lang]))

  return [...CSS_LANGUAGES, ...userCssLanguages].indexOf(doc.languageId) !== -1
}

export function isCssContext(
  state: State,
  doc: TextDocument,
  position: Position
): boolean {
  if (isCssDoc(state, doc)) {
    return true
  }

  if (isHtmlDoc(state, doc) || isVueDoc(doc) || isSvelteDoc(doc)) {
    let str = doc.getText({
      start: { line: 0, character: 0 },
      end: position,
    })

    return isInsideTag(str, ['style'])
  }

  return false
}
