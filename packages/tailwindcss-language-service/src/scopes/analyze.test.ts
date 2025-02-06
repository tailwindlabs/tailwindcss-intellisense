import dedent from 'dedent'
import { test } from 'vitest'
import { analyzeDocument } from './analyze'
import { State } from '../util/state'
import { TextDocument } from 'vscode-languageserver-textdocument'

const html = dedent
const css = dedent
const content = html`
  <html>
    <head>
      <style>
        .foo {
          @apply bg-red-500 text-white;
        }
      </style>
    </head>
    <body>
      <div class="bg-red-500 underline">Hello, world!</div>
      <script>
        export function Home() {
          return <div className="bg-red-500 underline">Hello, world!</div>
        }
      </script>
    </body>
  </html>
`

interface Options {
  lang: string
  content: string
}

async function analyze(opts: Options) {
  let state: State = {
    enabled: true,
    blocklist: [],
    editor: {
      userLanguages: {},
      getConfiguration: async () =>
        ({
          editor: { tabSize: 2 },
          tailwindCSS: {
            classAttributes: ['class', 'className'],
            experimental: {
              classRegex: [],
            },
          },
        }) as any,
    } as any,
  }

  let scopes = await analyzeDocument(
    state,
    TextDocument.create(`file://test/test.${opts.lang}`, opts.lang, 0, opts.content),
  )

  return scopes.description(opts.content)
}

test('analyze', async ({ expect }) => {
  let scopes = await analyze({ lang: 'html', content })

  expect(scopes).toMatchInlineSnapshot(`
    "
    [  0,  20] context.html "<html>\\n  <head>\\n    "
    [ 20,  91] context.css "<style>\\n      .foo {..."
    [ 49,  55] css.at-rule.name "@apply"
    [ 56,  77] css.at-rule.params "bg-red-500 text-whit..."
    [ 56,  77] class.list "bg-red-500 text-whit..."
    [ 56,  66] class.name "bg-red-500"
    [ 67,  77] class.name "text-white"
    [ 91, 181] context.html "</style>\\n  </head>\\n ..."
    [135, 155] class.list "bg-red-500 underline"
    [135, 145] class.name "bg-red-500"
    [146, 155] class.name "underline"
    [181, 306] context.js "<script>\\n      expor..."
    [252, 272] class.list "bg-red-500 underline"
    [252, 262] class.name "bg-red-500"
    [263, 272] class.name "underline"
    [306, 333] context.html "</script>\\n  </body>\\n..."
    "
  `)
})

test('analyze partial at-rules', async ({ expect }) => {
  let scopes = await analyze({
    lang: 'css',
    content: css`
      .foo {
        @apply bg-red-500 text-white;
      }

      @vari /* */;
      @apply /* */;
      @theme inline;
    `,
  })

  expect(scopes).toMatchInlineSnapshot(`
    "
    [ 0, 83] context.css ".foo {\\n  @apply bg-r..."
    [ 9, 15] css.at-rule.name "@apply"
    [16, 37] css.at-rule.params "bg-red-500 text-whit..."
    [16, 37] class.list "bg-red-500 text-whit..."
    [16, 26] class.name "bg-red-500"
    [27, 37] class.name "text-white"
    [42, 47] css.at-rule.name "@vari"
    [48, 53] css.at-rule.params "/* */"
    [55, 61] css.at-rule.name "@apply"
    [62, 67] css.at-rule.params "/* */"
    [66, 67] class.list "/"
    [66, 66] class.name ""
    [67, 67] class.name ""
    [69, 75] css.at-rule.name "@theme"
    [76, 82] css.at-rule.params "inline"
    "
  `)
})

test('@utility has its own scope', async ({ expect }) => {
  let scopes = await analyze({
    lang: 'css',
    content: css`
      @utility foo {
        color: red;
      }

      @utility bar-* {
        color: --value(number);
      }
    `,
  })

  expect(scopes).toMatchInlineSnapshot(`
    "
    [ 0, 76] context.css "@utility foo {\\n  col..."
    [ 0,  8] css.at-rule.name "@utility"
    [ 9, 13] css.at-rule.params "foo "
    [ 9, 12] css.utility.name "foo"
    [13, 29] css.at-rule.body "{\\n  color: red;\\n"
    [13, 29] css.utility.static "{\\n  color: red;\\n"
    [32, 40] css.at-rule.name "@utility"
    [41, 47] css.at-rule.params "bar-* "
    [41, 44] css.utility.name "bar"
    [47, 75] css.at-rule.body "{\\n  color: --value(n..."
    [47, 75] css.utility.functional "{\\n  color: --value(n..."
    "
  `)
})

test('@import has its own scope', async ({ expect }) => {
  let scopes = await analyze({
    lang: 'css',
    content: css`
      @import './foo.css';
      @import url('./foo.css');
      @reference "./foo.css";
      @import './foo.css' source(none);
      @import './foo.css' source('./foo');
      @import './foo.css' source('./foo') theme(inline);
      @import './foo.css' theme(inline);
      @import './foo.css' theme(inline) source(none);
      @import './foo.css' theme();
      @import './foo.css' theme(inline reference default);
    `,
  })

  expect(scopes).toMatchInlineSnapshot(`
    "
    [  0, 357] context.css "@import './foo.css';..."
    [  0,   7] css.at-rule.name "@import"
    [  8,  19] css.at-rule.params "'./foo.css'"
    [  9,  18] css.import.url "./foo.css"
    [ 21,  28] css.at-rule.name "@import"
    [ 29,  45] css.at-rule.params "url('./foo.css')"
    [ 34,  43] css.import.url "./foo.css"
    [ 47,  57] css.at-rule.name "@reference"
    [ 58,  69] css.at-rule.params ""./foo.css""
    [ 71,  78] css.at-rule.name "@import"
    [ 79, 103] css.at-rule.params "'./foo.css' source(n..."
    [ 80,  89] css.import.url "./foo.css"
    [ 98, 102] css.import.source-url "none"
    [105, 112] css.at-rule.name "@import"
    [113, 140] css.at-rule.params "'./foo.css' source('..."
    [114, 123] css.import.url "./foo.css"
    [133, 138] css.import.source-url "./foo"
    [142, 149] css.at-rule.name "@import"
    [150, 191] css.at-rule.params "'./foo.css' source('..."
    [151, 160] css.import.url "./foo.css"
    [170, 175] css.import.source-url "./foo"
    [178, 183] css.fn.name "theme"
    [184, 190] css.import.theme-option-list "inline"
    [184, 190] css.import.theme-option "inline"
    [184, 190] css.fn.params "inline"
    [193, 200] css.at-rule.name "@import"
    [201, 226] css.at-rule.params "'./foo.css' theme(in..."
    [202, 211] css.import.url "./foo.css"
    [213, 218] css.fn.name "theme"
    [219, 225] css.import.theme-option-list "inline"
    [219, 225] css.import.theme-option "inline"
    [219, 225] css.fn.params "inline"
    [228, 235] css.at-rule.name "@import"
    [236, 274] css.at-rule.params "'./foo.css' theme(in..."
    [237, 246] css.import.url "./foo.css"
    [248, 253] css.fn.name "theme"
    [254, 260] css.import.theme-option-list "inline"
    [254, 260] css.import.theme-option "inline"
    [254, 260] css.fn.params "inline"
    [269, 273] css.import.source-url "none"
    [276, 283] css.at-rule.name "@import"
    [284, 303] css.at-rule.params "'./foo.css' theme()"
    [285, 294] css.import.url "./foo.css"
    [296, 301] css.fn.name "theme"
    [302, 302] css.import.theme-option-list ""
    [302, 302] css.import.theme-option ""
    [302, 302] css.fn.params ""
    [305, 312] css.at-rule.name "@import"
    [313, 356] css.at-rule.params "'./foo.css' theme(in..."
    [314, 323] css.import.url "./foo.css"
    [325, 330] css.fn.name "theme"
    [331, 355] css.import.theme-option-list "inline reference def..."
    [331, 355] css.fn.params "inline reference def..."
    [331, 337] css.import.theme-option "inline"
    [338, 347] css.import.theme-option "reference"
    [348, 355] css.import.theme-option "default"
    "
  `)
})

test('helper functions have their own scopes', async ({ expect }) => {
  let scopes = await analyze({
    lang: 'css',
    content: css`
      .foo {
        color: theme(--color-red-500);
        background: --alpha(var(--color-red-500));
      }
    `,
  })

  expect(scopes).toMatchInlineSnapshot(`
    "
    [ 0, 86] context.css ".foo {\\n  color: them..."
    [16, 21] css.fn.name "theme"
    [22, 37] css.fn.params "--color-red-500"
    [54, 61] css.fn.name "--alpha"
    [62, 82] css.fn.params "var(--color-red-500)"
    "
  `)
})
