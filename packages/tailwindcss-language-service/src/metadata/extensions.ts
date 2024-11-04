let scriptExtensions = [
  // JS
  'js',
  'cjs',
  'mjs',
  '(?<!d.)ts', // matches .ts but not .d.ts
  'mts',
  'cts',
]

let templateExtensions = [
  // HTML
  'html',
  'pug',

  // Glimmer
  'gjs',
  'gts',

  // JS
  'astro',
  'cjs',
  'cts',
  'jade',
  'js',
  'jsx',
  'mjs',
  'mts',
  'svelte',
  'ts',
  'tsx',
  'vue',

  // Markdown
  'md',
  'mdx',

  // ASP
  'aspx',
  'razor',

  // Handlebars
  'handlebars',
  'hbs',
  'mustache',

  // PHP
  'php',
  'twig',

  // Ruby
  'erb',
  'haml',
  'liquid',
  'rb',
  'rhtml',
  'slim',

  // Elixir / Phoenix
  'eex',
  'heex',

  // Nunjucks
  'njk',
  'nunjucks',

  // Python
  'py',
  'tpl',

  // Rust
  'rs',
]

export const IS_SCRIPT_SOURCE = new RegExp(`\\.(${scriptExtensions.join('|')})$`)
export const IS_TEMPLATE_SOURCE = new RegExp(`\\.(${templateExtensions.join('|')})$`)
