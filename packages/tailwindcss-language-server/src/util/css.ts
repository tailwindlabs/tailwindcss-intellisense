import { TextDocument } from 'vscode-languageserver'

export const CSS_LANGUAGES = [
  'css',
  'less',
  'postcss',
  'sass',
  'scss',
  'stylus',
  'svelte',
  'vue'
]

export function isCssDoc(doc: TextDocument): boolean {
  return CSS_LANGUAGES.indexOf(doc.languageId) !== -1
}
