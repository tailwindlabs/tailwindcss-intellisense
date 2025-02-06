import dedent from 'dedent'
import { test } from 'vitest'
import { analyzeDocument } from './analyze'
import { State } from '../util/state'
import { TextDocument } from 'vscode-languageserver-textdocument'
import { ScopeTree } from './tree'
import { printScopes } from './walk'

const html = dedent
const css = dedent
const content = html`
  <html>
    <head>
      <style>
        @import 'tailwindcss' theme(static);

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

  function wrap(tree: ScopeTree) {
    return Object.create(tree, {
      toString: {
        value: () => printScopes(tree.all(), opts.content),
      },
    })
  }

  let scopes = await analyzeDocument(
    state,
    TextDocument.create(`file://test/test.${opts.lang}`, opts.lang, 0, opts.content),
  )

  return Object.create(scopes, {
    toString: {
      value: () => printScopes(scopes.all(), opts.content),
    },
  })
}

test('analyze', async ({ expect }) => {
  let scopes = await analyze({ lang: 'html', content })

  expect(scopes.toString()).toMatchInlineSnapshot(`
    "
    context [0-20]: "<html>\\n  <head>\\n    "
      - syntax: html
      - lang: html
    context [20-135]: "<style>\\n      @impor..."
      - syntax: css
      - lang: css
      css.at-rule [34-69]: "@import 'tailwindcss..."
        - name [34-41]: "@import"
        - params [42-69]: "'tailwindcss' theme(..."
        - body (none)
        css.at-rule.import [34-69]: "@import 'tailwindcss..."
          - url [43-54]: "tailwindcss"
          - sourceUrl (none)
          theme.option.list [62-68]: "static"
            theme.option.name [62-68]: "static"
      css.at-rule [93-121]: "@apply bg-red-500 te..."
        - name [93-99]: "@apply"
        - params [100-121]: "bg-red-500 text-whit..."
        - body (none)
        class.list [100-121]: "bg-red-500 text-whit..."
          class.name [100-110]: "bg-red-500"
          class.name [111-121]: "text-white"
    context [135-225]: "</style>\\n  </head>\\n ..."
      - syntax: html
      - lang: html
      class.list [179-199]: "bg-red-500 underline"
        class.name [179-189]: "bg-red-500"
        class.name [190-199]: "underline"
    context [225-350]: "<script>\\n      expor..."
      - syntax: js
      - lang: js
      class.list [296-316]: "bg-red-500 underline"
        class.name [296-306]: "bg-red-500"
        class.name [307-316]: "underline"
    context [350-377]: "</script>\\n  </body>\\n..."
      - syntax: html
      - lang: html
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

  expect(scopes.toString()).toMatchInlineSnapshot(`
    "
    context [0-83]: ".foo {\\n  @apply bg-r..."
      - syntax: css
      - lang: css
      css.at-rule [9-37]: "@apply bg-red-500 te..."
        - name [9-15]: "@apply"
        - params [16-37]: "bg-red-500 text-whit..."
        - body (none)
        class.list [16-37]: "bg-red-500 text-whit..."
          class.name [16-26]: "bg-red-500"
          class.name [27-37]: "text-white"
      css.at-rule [42-53]: "@vari /* */"
        - name [42-47]: "@vari"
        - params [48-53]: "/* */"
        - body (none)
      css.at-rule [55-67]: "@apply /* */"
        - name [55-61]: "@apply"
        - params [62-67]: "/* */"
        - body (none)
        class.list [66-67]: "/"
          class.name [66-66]: ""
          class.name [67-67]: ""
      css.at-rule [69-82]: "@theme inline"
        - name [69-75]: "@theme"
        - params [76-82]: "inline"
        - body (none)
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

  expect(scopes.toString()).toMatchInlineSnapshot(`
    "
    context [0-76]: "@utility foo {\\n  col..."
      - syntax: css
      - lang: css
      css.at-rule [0-29]: "@utility foo {\\n  col..."
        - name [0-8]: "@utility"
        - params [9-13]: "foo "
        - body [13-29]: "{\\n  color: red;\\n"
        css.at-rule.utility [0-29]: "@utility foo {\\n  col..."
          - name [9-12]: "foo"
          - kind: static
      css.at-rule [32-75]: "@utility bar-* {\\n  c..."
        - name [32-40]: "@utility"
        - params [41-47]: "bar-* "
        - body [47-75]: "{\\n  color: --value(n..."
        css.at-rule.utility [32-75]: "@utility bar-* {\\n  c..."
          - name [41-44]: "bar"
          - kind: functional
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

  expect(scopes.toString()).toMatchInlineSnapshot(`
    "
    context [0-357]: "@import './foo.css';..."
      - syntax: css
      - lang: css
      css.at-rule [0-19]: "@import './foo.css'"
        - name [0-7]: "@import"
        - params [8-19]: "'./foo.css'"
        - body (none)
        css.at-rule.import [0-19]: "@import './foo.css'"
          - url [9-18]: "./foo.css"
          - sourceUrl (none)
      css.at-rule [21-45]: "@import url('./foo.c..."
        - name [21-28]: "@import"
        - params [29-45]: "url('./foo.css')"
        - body (none)
        css.at-rule.import [21-45]: "@import url('./foo.c..."
          - url [34-43]: "./foo.css"
          - sourceUrl (none)
      css.at-rule [47-69]: "@reference "./foo.cs..."
        - name [47-57]: "@reference"
        - params [58-69]: ""./foo.css""
        - body (none)
      css.at-rule [71-103]: "@import './foo.css' ..."
        - name [71-78]: "@import"
        - params [79-103]: "'./foo.css' source(n..."
        - body (none)
        css.at-rule.import [71-103]: "@import './foo.css' ..."
          - url [80-89]: "./foo.css"
          - sourceUrl [98-102]: "none"
      css.at-rule [105-140]: "@import './foo.css' ..."
        - name [105-112]: "@import"
        - params [113-140]: "'./foo.css' source('..."
        - body (none)
        css.at-rule.import [105-140]: "@import './foo.css' ..."
          - url [114-123]: "./foo.css"
          - sourceUrl [133-138]: "./foo"
      css.at-rule [142-191]: "@import './foo.css' ..."
        - name [142-149]: "@import"
        - params [150-191]: "'./foo.css' source('..."
        - body (none)
        css.at-rule.import [142-191]: "@import './foo.css' ..."
          - url [151-160]: "./foo.css"
          - sourceUrl [170-175]: "./foo"
          theme.option.list [184-190]: "inline"
            theme.option.name [184-190]: "inline"
      css.at-rule [193-226]: "@import './foo.css' ..."
        - name [193-200]: "@import"
        - params [201-226]: "'./foo.css' theme(in..."
        - body (none)
        css.at-rule.import [193-226]: "@import './foo.css' ..."
          - url [202-211]: "./foo.css"
          - sourceUrl (none)
          theme.option.list [219-225]: "inline"
            theme.option.name [219-225]: "inline"
      css.at-rule [228-274]: "@import './foo.css' ..."
        - name [228-235]: "@import"
        - params [236-274]: "'./foo.css' theme(in..."
        - body (none)
        css.at-rule.import [228-274]: "@import './foo.css' ..."
          - url [237-246]: "./foo.css"
          - sourceUrl [269-273]: "none"
          theme.option.list [254-260]: "inline"
            theme.option.name [254-260]: "inline"
      css.at-rule [276-303]: "@import './foo.css' ..."
        - name [276-283]: "@import"
        - params [284-303]: "'./foo.css' theme()"
        - body (none)
        css.at-rule.import [276-303]: "@import './foo.css' ..."
          - url [285-294]: "./foo.css"
          - sourceUrl (none)
          theme.option.list [302-302]: ""
            theme.option.name [302-302]: ""
      css.at-rule [305-356]: "@import './foo.css' ..."
        - name [305-312]: "@import"
        - params [313-356]: "'./foo.css' theme(in..."
        - body (none)
        css.at-rule.import [305-356]: "@import './foo.css' ..."
          - url [314-323]: "./foo.css"
          - sourceUrl (none)
          theme.option.list [331-355]: "inline reference def..."
            theme.option.name [331-337]: "inline"
            theme.option.name [338-347]: "reference"
            theme.option.name [348-355]: "default"
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

  expect(scopes.toString()).toMatchInlineSnapshot(`
    "
    context [0-86]: ".foo {\\n  color: them..."
      - syntax: css
      - lang: css
      css.fn [16-38]: "theme(--color-red-50..."
        - name [16-21]: "theme"
        - params [22-37]: "--color-red-500"
      css.fn [54-83]: "--alpha(var(--color-..."
        - name [54-61]: "--alpha"
        - params [62-82]: "var(--color-red-500)"
    "
  `)
})

test('helper functions have their own scopes', async ({ expect }) => {
  let scopes = await analyze({
    lang: 'html',
    content: html`
      <head>
        <style>
          .foo {
            @apply bg-black text-white;
            @apply flex underline;
            @apply after this;
          }
        </style>
      </head>
    `,
  })

  expect(scopes.toString()).toMatchInlineSnapshot(`
    "
    context [0-9]: "<head>\\n  "
      - syntax: html
      - lang: html
    context [9-124]: "<style>\\n    .foo {\\n ..."
      - syntax: css
      - lang: css
      css.at-rule [34-60]: "@apply bg-black text..."
        - name [34-40]: "@apply"
        - params [41-60]: "bg-black text-white"
        - body (none)
        class.list [41-60]: "bg-black text-white"
          class.name [41-49]: "bg-black"
          class.name [50-60]: "text-white"
      css.at-rule [68-89]: "@apply flex underlin..."
        - name [68-74]: "@apply"
        - params [75-89]: "flex underline"
        - body (none)
        class.list [75-89]: "flex underline"
          class.name [75-79]: "flex"
          class.name [80-89]: "underline"
      css.at-rule [97-114]: "@apply after this"
        - name [97-103]: "@apply"
        - params [104-114]: "after this"
        - body (none)
        class.list [104-114]: "after this"
          class.name [104-109]: "after"
          class.name [110-114]: "this"
    context [124-140]: "</style>\\n</head>"
      - syntax: html
      - lang: html
    "
  `)
})

test('ScopeTree#at', async ({ expect }) => {
  let scopes = await analyze({ lang: 'html', content })

  for (let i = 0; i < 21; ++i) {
    expect(scopes.at(i).at(-1)).toMatchObject({ kind: 'context', meta: { syntax: 'html' } })
  }

  for (let i = 21; i < 34; ++i) {
    expect(scopes.at(i).at(-1)).toMatchObject({ kind: 'context', meta: { syntax: 'css' } })
  }

  for (let i = 34; i < 62; ++i) {
    expect(scopes.at(i).at(-1)).toMatchObject({ kind: 'css.at-rule.import' })
  }
  for (let i = 62; i < 69; ++i) {
    expect(scopes.at(i).at(-1)).toMatchObject({ kind: 'theme.option.name' })
  }

  expect(scopes.toString()).toMatchInlineSnapshot(`
    "
    context [0-20]: "<html>\\n  <head>\\n    "
      - syntax: html
      - lang: html
    context [20-135]: "<style>\\n      @impor..."
      - syntax: css
      - lang: css
      css.at-rule [34-69]: "@import 'tailwindcss..."
        - name [34-41]: "@import"
        - params [42-69]: "'tailwindcss' theme(..."
        - body (none)
        css.at-rule.import [34-69]: "@import 'tailwindcss..."
          - url [43-54]: "tailwindcss"
          - sourceUrl (none)
          theme.option.list [62-68]: "static"
            theme.option.name [62-68]: "static"
      css.at-rule [93-121]: "@apply bg-red-500 te..."
        - name [93-99]: "@apply"
        - params [100-121]: "bg-red-500 text-whit..."
        - body (none)
        class.list [100-121]: "bg-red-500 text-whit..."
          class.name [100-110]: "bg-red-500"
          class.name [111-121]: "text-white"
    context [135-225]: "</style>\\n  </head>\\n ..."
      - syntax: html
      - lang: html
      class.list [179-199]: "bg-red-500 underline"
        class.name [179-189]: "bg-red-500"
        class.name [190-199]: "underline"
    context [225-350]: "<script>\\n      expor..."
      - syntax: js
      - lang: js
      class.list [296-316]: "bg-red-500 underline"
        class.name [296-306]: "bg-red-500"
        class.name [307-316]: "underline"
    context [350-377]: "</script>\\n  </body>\\n..."
      - syntax: html
      - lang: html
    "
  `)
})
