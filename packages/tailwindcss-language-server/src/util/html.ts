import { TextDocument, Position } from 'vscode-languageserver'
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
  'twig',
  ...JS_LANGUAGES,
]

function isHtmlDoc(doc: TextDocument): boolean {
  return HTML_LANGUAGES.indexOf(doc.languageId) !== -1
}

function isVueDoc(doc: TextDocument): boolean {
  return doc.languageId === 'vue'
}

function isSvelteDoc(doc: TextDocument): boolean {
  return doc.languageId === 'svelte'
}

export function isMixedDoc(doc: TextDocument): boolean {
  return isVueDoc(doc) || isSvelteDoc(doc)
}

export function isHtmlContext(doc: TextDocument, position: Position): boolean {
  if (isHtmlDoc(doc)) {
    return true
  }

  if (isMixedDoc(doc)) {
    let str = doc.getText({
      start: { line: 0, character: 0 },
      end: position,
    })

    if (isVueDoc(doc)) {
      return isInsideTag(str, ['template', 'script'])
    }

    if (isSvelteDoc(doc)) {
      return !isInsideTag(str, ['style'])
    }
  }

  return false
}

export function isInsideTag(str: string, tag: string | string[]): boolean {
  let open = 0
  let close = 0
  let match: RegExpExecArray
  let tags = Array.isArray(tag) ? tag : [tag]
  let regex = new RegExp(`<(?<slash>/?)(?:${tags.join('|')})\\b`, 'ig')
  while ((match = regex.exec(str)) !== null) {
    if (match.groups.slash) {
      close += 1
    } else {
      open += 1
    }
  }
  return open > 0 && open > close
}
