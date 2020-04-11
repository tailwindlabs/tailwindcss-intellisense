import { TextDocument } from 'vscode-languageserver'
import { JS_LANGUAGES } from './js'

export const HTML_LANGUAGES = [
  'blade',
  'django-html',
  'edge',
  'ejs',
  'erb',
  'haml',
  'handlebars',
  'html',
  'HTML (Eex)',
  'jade',
  'leaf',
  'markdown',
  'njk',
  'nunjucks',
  'php',
  'razor',
  'slim',
  'svelte',
  'twig',
  'vue',
  ...JS_LANGUAGES
]

export function isHtmlDoc(doc: TextDocument): boolean {
  return HTML_LANGUAGES.indexOf(doc.languageId) !== -1
}
