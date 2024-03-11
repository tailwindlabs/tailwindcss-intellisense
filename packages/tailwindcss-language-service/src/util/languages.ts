import type { EditorState } from './state'

export const htmlLanguages = [
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

export const cssLanguages = [
  'css',
  'less',
  'postcss',
  'sass',
  'scss',
  'stylus',
  'sugarss',
  'tailwindcss',
]

export const jsLanguages = [
  'javascript',
  'javascriptreact',
  'reason',
  'rescript',
  'typescript',
  'typescriptreact',
  'glimmer-js',
  'glimmer-ts',
]

export const specialLanguages = ['vue', 'svelte']

export const languages = [...cssLanguages, ...htmlLanguages, ...jsLanguages, ...specialLanguages]

const semicolonlessLanguages = ['sass', 'sugarss', 'stylus']

export function isSemicolonlessCssLanguage(
  languageId: string,
  userLanguages: EditorState['userLanguages'] = {},
) {
  return (
    semicolonlessLanguages.includes(languageId) ||
    semicolonlessLanguages.includes(userLanguages[languageId])
  )
}
