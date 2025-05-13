let scriptExtensions = [
  // JS
  'js',
  'cjs',
  'mjs',
  '(?<!d.)ts', // matches .ts but not .d.ts
  '(?<!d.)mts', // matches .mts but not .d.mts
  '(?<!d.)cts', // matches .cts but not .d.cts
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
  '(?<!d.)cts', // matches .cts but not .d.cts
  'jade',
  'js',
  'jsx',
  'mjs',
  '(?<!d.)mts', // matches .mts but not .d.mts
  'svelte',
  '(?<!d.)ts', // matches .ts but not .d.ts
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

export const IS_SCRIPT_SOURCE: RegExp = new RegExp(`\\.(${scriptExtensions.join('|')})$`)
export const IS_TEMPLATE_SOURCE: RegExp = new RegExp(`\\.(${templateExtensions.join('|')})$`)
