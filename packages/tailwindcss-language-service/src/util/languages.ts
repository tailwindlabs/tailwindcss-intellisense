import type { EditorState } from './state'

export const htmlLanguages: string[] = [
  'aspnetcorerazor',
  'astro',
  'astro-markdown',
  'blade',
  'django-html',
  'edge',
  'ejs',
  'erb',
  'gohtml',
  'GoHTML',
  'gohtmltmpl',
  'haml',
  'handlebars',
  'hbs',
  'html',
  'HTML (Eex)',
  'HTML (EEx)',
  'html-eex',
  'htmldjango',
  'jade',
  'latte',
  'leaf',
  'liquid',
  'markdown',
  'mdx',
  'mustache',
  'njk',
  'nunjucks',
  'phoenix-heex',
  'php',
  'razor',
  'slim',
  'surface',
  'twig',
]

export const cssLanguages: string[] = [
  'css',
  'less',
  'postcss',
  'sass',
  'scss',
  'stylus',
  'sugarss',
  'tailwindcss',
]

export const jsLanguages: string[] = [
  'javascript',
  'javascriptreact',
  'reason',
  'rescript',
  'typescript',
  'typescriptreact',
  'glimmer-js',
  'glimmer-ts',
]

export const specialLanguages: string[] = ['vue', 'svelte']

export const languages: string[] = [
  ...cssLanguages,
  ...htmlLanguages,
  ...jsLanguages,
  ...specialLanguages,
]

const semicolonlessLanguages = ['sass', 'sugarss', 'stylus']

export function isSemicolonlessCssLanguage(
  languageId: string,
  userLanguages: EditorState['userLanguages'] = {},
): boolean {
  return (
    semicolonlessLanguages.includes(languageId) ||
    semicolonlessLanguages.includes(userLanguages[languageId])
  )
}
