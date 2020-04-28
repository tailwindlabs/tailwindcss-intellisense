import { TextDocument, Position } from 'vscode-languageserver'

export const HTML_LANGUAGES = [
  'aspnetcorerazor',
  'blade',
  'django-html',
  'edge',
  'ejs',
  'erb',
  'haml',
  'handlebars',
  'hbs',
  'html',
  'HTML (Eex)',
  'jade',
  'leaf',
  'liquid',
  'markdown',
  'njk',
  'nunjucks',
  'php',
  'razor',
  'slim',
  'twig',
]

export function isHtmlDoc(doc: TextDocument): boolean {
  return HTML_LANGUAGES.indexOf(doc.languageId) !== -1
}

export function isVueDoc(doc: TextDocument): boolean {
  return doc.languageId === 'vue'
}

export function isSvelteDoc(doc: TextDocument): boolean {
  return doc.languageId === 'svelte'
}

export function isHtmlContext(doc: TextDocument, position: Position): boolean {
  let str = doc.getText({
    start: { line: 0, character: 0 },
    end: position,
  })

  if (isHtmlDoc(doc) && !isInsideTag(str, ['script', 'style'])) {
    return true
  }

  if (isVueDoc(doc)) {
    return isInsideTag(str, ['template'])
  }

  if (isSvelteDoc(doc)) {
    return !isInsideTag(str, ['script', 'style'])
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
