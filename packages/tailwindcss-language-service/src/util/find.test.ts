import { test } from 'vitest'
import {
  findClassListsInHtmlRange,
  findClassNameAtPosition,
  findHelperFunctionsInDocument,
} from './find'
import { js, html, pug, createDocument, css } from './test-utils'
import type { Range } from 'vscode-languageserver-textdocument'

const range = (startLine: number, startCol: number, endLine: number, endCol: number): Range => ({
  start: { line: startLine, character: startCol },
  end: { line: endLine, character: endCol },
})

test('class regex works in astro', async ({ expect }) => {
  let file = createDocument({
    name: 'file.astro',
    lang: 'astro',
    settings: {
      tailwindCSS: {
        classAttributes: ['class'],
        experimental: {
          classRegex: [
            ['cva\\(([^)]*)\\)', '["\'`]([^"\'`]*).*?["\'`]'],
            ['cn\\(([^)]*)\\)', '["\'`]([^"\'`]*).*?["\'`]'],
          ],
        },
      },
    },
    content: [
      '<a class=`p-4 sm:p-2 ${active ? "underline": "line-through"}`>',
      '  <slot />',
      '</a>',
    ],
  })

  let classLists = await findClassListsInHtmlRange(file.state, file.doc, 'html')

  expect(classLists).toEqual([
    {
      classList: 'p-4 sm:p-2 $',
      range: {
        start: { line: 0, character: 10 },
        end: { line: 0, character: 22 },
      },
    },
    {
      classList: 'underline',
      range: {
        start: { line: 0, character: 33 },
        end: { line: 0, character: 42 },
      },
    },
    {
      classList: 'line-through',
      range: {
        start: { line: 0, character: 46 },
        end: { line: 0, character: 58 },
      },
    },
  ])
})

test('find class lists in functions', async ({ expect }) => {
  let fileA = createDocument({
    name: 'file.jsx',
    lang: 'javascriptreact',
    settings: {
      tailwindCSS: {
        classFunctions: ['clsx', 'cva'],
      },
    },
    content: js`
      // These should match
      let classes = clsx(
        'flex p-4',
        'block sm:p-0',
        Date.now() > 100 ? 'text-white' : 'text-black',
      )

      // These should match
      let classes = cva(
        'flex p-4',
        'block sm:p-0',
        Date.now() > 100 ? 'text-white' : 'text-black',
      )
    `,
  })

  let fileB = createDocument({
    name: 'file.jsx',
    lang: 'javascriptreact',
    settings: {
      tailwindCSS: {
        classFunctions: ['clsx', 'cva'],
      },
    },
    content: js`
      let classes = cn(
        'flex p-4',
        'block sm:p-0',
        Date.now() > 100 ? 'text-white' : 'text-black',
      )
    `,
  })

  let classListsA = await findClassListsInHtmlRange(fileA.state, fileA.doc, 'js')
  let classListsB = await findClassListsInHtmlRange(fileB.state, fileB.doc, 'js')

  expect(classListsA).toEqual([
    // from clsx(…)
    {
      classList: 'flex p-4',
      range: {
        start: { line: 2, character: 3 },
        end: { line: 2, character: 11 },
      },
    },
    {
      classList: 'block sm:p-0',
      range: {
        start: { line: 3, character: 3 },
        end: { line: 3, character: 15 },
      },
    },
    {
      classList: 'text-white',
      range: {
        start: { line: 4, character: 22 },
        end: { line: 4, character: 32 },
      },
    },
    {
      classList: 'text-black',
      range: {
        start: { line: 4, character: 37 },
        end: { line: 4, character: 47 },
      },
    },

    // from cva(…)
    {
      classList: 'flex p-4',
      range: {
        start: { line: 9, character: 3 },
        end: { line: 9, character: 11 },
      },
    },
    {
      classList: 'block sm:p-0',
      range: {
        start: { line: 10, character: 3 },
        end: { line: 10, character: 15 },
      },
    },
    {
      classList: 'text-white',
      range: {
        start: { line: 11, character: 22 },
        end: { line: 11, character: 32 },
      },
    },
    {
      classList: 'text-black',
      range: {
        start: { line: 11, character: 37 },
        end: { line: 11, character: 47 },
      },
    },
  ])

  // none from cn(…) since it's not in the list of class functions
  expect(classListsB).toEqual([])
})

test('find class lists in nested fn calls', async ({ expect }) => {
  let file = createDocument({
    name: 'file.jsx',
    lang: 'javascriptreact',
    settings: {
      tailwindCSS: {
        classFunctions: ['clsx', 'cva'],
      },
    },

    content: js`
      // NOTE: All strings inside a matched class function will be treated as class lists
      // TODO: Nested calls tha are *not* class functions should have their content ignored
      let classes = clsx(
        'flex',
        cn({
          'bg-red-500': true,
          'text-white': Date.now() > 100,
        }),
        clsx(
          'fixed',
          'absolute inset-0'
        ),
        cva(
          ['bottom-0', 'border'],
          {
            variants: {
              mobile: {
                default: 'bottom-0 left-0',
                large: \`
                  inset-0
                  rounded-none
                \`,
              },
            }
          }
        )
      )
    `,
  })

  let classLists = await findClassListsInHtmlRange(file.state, file.doc, 'html')

  expect(classLists).toMatchObject([
    {
      classList: 'flex',
      range: {
        start: { line: 3, character: 3 },
        end: { line: 3, character: 7 },
      },
    },

    // TODO: This should be ignored because they're inside cn(…)
    {
      classList: 'bg-red-500',
      range: {
        start: { line: 5, character: 5 },
        end: { line: 5, character: 15 },
      },
    },

    // TODO: This should be ignored because they're inside cn(…)
    {
      classList: 'text-white',
      range: {
        start: { line: 6, character: 5 },
        end: { line: 6, character: 15 },
      },
    },

    {
      classList: 'fixed',
      range: {
        start: { line: 9, character: 5 },
        end: { line: 9, character: 10 },
      },
    },
    {
      classList: 'absolute inset-0',
      range: {
        start: { line: 10, character: 5 },
        end: { line: 10, character: 21 },
      },
    },
    {
      classList: 'bottom-0',
      range: {
        start: { line: 13, character: 6 },
        end: { line: 13, character: 14 },
      },
    },
    {
      classList: 'border',
      range: {
        start: { line: 13, character: 18 },
        end: { line: 13, character: 24 },
      },
    },
    {
      classList: 'bottom-0 left-0',
      range: {
        start: { line: 17, character: 20 },
        end: { line: 17, character: 35 },
      },
    },
    {
      classList: `inset-0\n            rounded-none\n          `,
      range: {
        start: { line: 19, character: 12 },
        // TODO: Fix the range calculation. Its wrong on this one
        end: { line: 20, character: 24 },
      },
    },
  ])
})

test('find class lists in nested fn calls (only nested matches)', async ({ expect }) => {
  let file = createDocument({
    name: 'file.jsx',
    lang: 'javascriptreact',
    settings: {
      tailwindCSS: {
        classFunctions: ['clsx', 'cva'],
      },
    },

    content: js`
      let classes = cn(
        'flex',
        cn({
          'bg-red-500': true,
          'text-white': Date.now() > 100,
        }),
        // NOTE: The only class lists appear inside this function because cn is
        // not in the list of class functions
        clsx(
          'fixed',
          'absolute inset-0'
        ),
      )
    `,
  })

  let classLists = await findClassListsInHtmlRange(file.state, file.doc, 'html')

  expect(classLists).toMatchObject([
    {
      classList: 'fixed',
      range: {
        start: { line: 9, character: 5 },
        end: { line: 9, character: 10 },
      },
    },
    {
      classList: 'absolute inset-0',
      range: {
        start: { line: 10, character: 5 },
        end: { line: 10, character: 21 },
      },
    },
  ])
})

test('find class lists in tagged template literals', async ({ expect }) => {
  let fileA = createDocument({
    name: 'file.jsx',
    lang: 'javascriptreact',
    settings: {
      tailwindCSS: {
        classFunctions: ['clsx', 'cva'],
      },
    },
    content: js`
      // These should match
      let classes = clsx\`
        flex p-4
        block sm:p-0
        \${Date.now() > 100 ? 'text-white' : 'text-black'}
      \`

      // These should match
      let classes = cva\`
        flex p-4
        block sm:p-0
        \${Date.now() > 100 ? 'text-white' : 'text-black'}
      \`
    `,
  })

  let fileB = createDocument({
    name: 'file.jsx',
    lang: 'javascriptreact',
    settings: {
      tailwindCSS: {
        classFunctions: ['clsx', 'cva'],
      },
    },
    content: js`
      let classes = cn\`
        flex p-4
        block sm:p-0
        \${Date.now() > 100 ? 'text-white' : 'text-black'}
      \`
    `,
  })

  let classListsA = await findClassListsInHtmlRange(fileA.state, fileA.doc, 'js')
  let classListsB = await findClassListsInHtmlRange(fileB.state, fileB.doc, 'js')

  expect(classListsA).toEqual([
    // from clsx`…`
    {
      classList: 'flex p-4\n  block sm:p-0\n  $',
      range: {
        start: { line: 2, character: 2 },
        end: { line: 4, character: 3 },
      },
    },
    {
      classList: 'text-white',
      range: {
        start: { line: 4, character: 24 },
        end: { line: 4, character: 34 },
      },
    },
    {
      classList: 'text-black',
      range: {
        start: { line: 4, character: 39 },
        end: { line: 4, character: 49 },
      },
    },

    // from cva`…`
    {
      classList: 'flex p-4\n  block sm:p-0\n  $',
      range: {
        start: { line: 9, character: 2 },
        end: { line: 11, character: 3 },
      },
    },
    {
      classList: 'text-white',
      range: {
        start: { line: 11, character: 24 },
        end: { line: 11, character: 34 },
      },
    },
    {
      classList: 'text-black',
      range: {
        start: { line: 11, character: 39 },
        end: { line: 11, character: 49 },
      },
    },
  ])

  // none from cn`…` since it's not in the list of class functions
  expect(classListsB).toEqual([])
})

test('classFunctions can be a regex', async ({ expect }) => {
  let fileA = createDocument({
    name: 'file.jsx',
    lang: 'javascriptreact',
    settings: {
      tailwindCSS: {
        classFunctions: ['tw\\.[a-z]+'],
      },
    },
    content: js`
      let classes = tw.div('flex p-4')
    `,
  })

  let fileB = createDocument({
    name: 'file.jsx',
    lang: 'javascriptreact',
    settings: {
      tailwindCSS: {
        classFunctions: ['tw\\.[a-z]+'],
      },
    },
    content: js`
      let classes = tw.div.foo('flex p-4')
    `,
  })

  let classListsA = await findClassListsInHtmlRange(fileA.state, fileA.doc, 'js')
  let classListsB = await findClassListsInHtmlRange(fileB.state, fileB.doc, 'js')

  expect(classListsA).toEqual([
    {
      classList: 'flex p-4',
      range: {
        start: { line: 0, character: 22 },
        end: { line: 0, character: 30 },
      },
    },
  ])

  // none from tw.div.foo(`…`) since it does not match a class function
  expect(classListsB).toEqual([])
})

test('classFunctions regexes only match on function names', async ({ expect }) => {
  let file = createDocument({
    name: 'file.jsx',
    lang: 'javascriptreact',
    settings: {
      tailwindCSS: {
        // A function name itself cannot contain a `:`
        classFunctions: [':\\s*tw\\.[a-z]+'],
      },
    },
    content: js`
      let classes = tw.div('flex p-4')
      let classes = { foo: tw.div('flex p-4') }
    `,
  })

  let classLists = await findClassListsInHtmlRange(file.state, file.doc, 'js')

  expect(classLists).toEqual([])
})

test('Finds consecutive instances of a class function', async ({ expect }) => {
  let file = createDocument({
    name: 'file.js',
    lang: 'javascript',
    settings: {
      tailwindCSS: {
        classFunctions: ['cn'],
      },
    },
    content: js`
      export const list = [
        cn('relative flex bg-red-500'),
        cn('relative flex bg-red-500'),
        cn('relative flex bg-red-500'),
      ]
    `,
  })

  let classLists = await findClassListsInHtmlRange(file.state, file.doc, 'js')

  expect(classLists).toEqual([
    {
      classList: 'relative flex bg-red-500',
      range: {
        start: { line: 1, character: 6 },
        end: { line: 1, character: 30 },
      },
    },
    {
      classList: 'relative flex bg-red-500',
      range: {
        start: { line: 2, character: 6 },
        end: { line: 2, character: 30 },
      },
    },
    {
      classList: 'relative flex bg-red-500',
      range: {
        start: { line: 3, character: 6 },
        end: { line: 3, character: 30 },
      },
    },
  ])
})

test('classFunctions & classAttributes should not duplicate matches', async ({ expect }) => {
  let file = createDocument({
    name: 'file.jsx',
    lang: 'javascriptreact',
    settings: {
      tailwindCSS: {
        classAttributes: ['className'],
        classFunctions: ['cva', 'clsx'],
      },
    },
    content: js`
      const Component = ({ className }) => (
        <div
          className={clsx(
            'relative flex',
            'inset-0 md:h-[calc(100%-2rem)]',
            clsx('rounded-none bg-blue-700', className),
          )}
        >
          CONTENT
        </div>
      )
      const OtherComponent = ({ className }) => (
        <div
          className={clsx(
            'relative flex',
            'inset-0 md:h-[calc(100%-2rem)]',
            clsx('rounded-none bg-blue-700', className),
          )}
        >
          CONTENT
        </div>
      )
    `,
  })

  let classLists = await findClassListsInHtmlRange(file.state, file.doc, 'js')

  expect(classLists).toEqual([
    {
      classList: 'relative flex',
      range: {
        start: { line: 3, character: 7 },
        end: { line: 3, character: 20 },
      },
    },
    {
      classList: 'inset-0 md:h-[calc(100%-2rem)]',
      range: {
        start: { line: 4, character: 7 },
        end: { line: 4, character: 37 },
      },
    },
    {
      classList: 'rounded-none bg-blue-700',
      range: {
        start: { line: 5, character: 12 },
        end: { line: 5, character: 36 },
      },
    },
    {
      classList: 'relative flex',
      range: {
        start: { line: 14, character: 7 },
        end: { line: 14, character: 20 },
      },
    },
    {
      classList: 'inset-0 md:h-[calc(100%-2rem)]',
      range: {
        start: { line: 15, character: 7 },
        end: { line: 15, character: 37 },
      },
    },
    {
      classList: 'rounded-none bg-blue-700',
      range: {
        start: { line: 16, character: 12 },
        end: { line: 16, character: 36 },
      },
    },
  ])
})

test('classFunctions should only match in JS-like contexts', async ({ expect }) => {
  let file = createDocument({
    name: 'file.html',
    lang: 'html',
    settings: {
      tailwindCSS: {
        classAttributes: ['className'],
        classFunctions: ['clsx'],
      },
    },
    content: html`
      <!-- These should not match -->
      clsx('relative flex') clsx('relative flex')

      <!-- These should match -->
      <script>
        let x = clsx('relative flex')
        let y = clsx('relative flex')
      </script>

      <!-- These still should not match -->
      clsx('relative flex') clsx('relative flex')

      <!-- These should match -->
      <script>
        let z = clsx('relative flex')
        let w = clsx('relative flex')
      </script>
    `,
  })

  let classLists = await findClassListsInHtmlRange(file.state, file.doc, 'js')

  expect(classLists).toEqual([
    {
      classList: 'relative flex',
      range: {
        start: { line: 5, character: 16 },
        end: { line: 5, character: 29 },
      },
    },
    {
      classList: 'relative flex',
      range: {
        start: { line: 6, character: 16 },
        end: { line: 6, character: 29 },
      },
    },
    {
      classList: 'relative flex',
      range: {
        start: { line: 14, character: 16 },
        end: { line: 14, character: 29 },
      },
    },
    {
      classList: 'relative flex',
      range: {
        start: { line: 15, character: 16 },
        end: { line: 15, character: 29 },
      },
    },
  ])
})

test('classAttributes find class lists inside variables in JS(X)/TS(X)', async ({ expect }) => {
  let file = createDocument({
    name: 'file.html',
    lang: 'javascript',
    settings: {
      tailwindCSS: {
        classAttributes: ['className'],
      },
    },
    content: js`
      let className = {
        a: "relative flex",
        nested: {
          b: "relative flex",
        },
        inFn: fn({
          c: "relative flex",
        })
      }

      let other = {
        a: "relative flex",
      }
    `,
  })

  let classLists = await findClassListsInHtmlRange(file.state, file.doc, 'js')

  expect(classLists).toEqual([
    {
      classList: 'relative flex',
      range: {
        start: { line: 1, character: 6 },
        end: { line: 1, character: 19 },
      },
    },
    {
      classList: 'relative flex',
      range: {
        start: { line: 3, character: 8 },
        end: { line: 3, character: 21 },
      },
    },
    {
      classList: 'relative flex',
      range: {
        start: { line: 6, character: 8 },
        end: { line: 6, character: 21 },
      },
    },
  ])
})

test('classAttributes find class lists inside pug', async ({ expect }) => {
  let file = createDocument({
    name: 'file.pug',
    lang: 'pug',
    settings: {
      tailwindCSS: {
        classAttributes: ['className'],
      },
    },
    content: pug`
      div(classNAme="relative flex")
    `,
  })

  let classLists = await findClassListsInHtmlRange(file.state, file.doc, 'js')

  expect(classLists).toEqual([
    {
      classList: 'relative flex',
      range: {
        start: { line: 0, character: 15 },
        end: { line: 0, character: 28 },
      },
    },
  ])
})

test('classAttributes find class lists inside Vue bindings', async ({ expect }) => {
  let file = createDocument({
    name: 'file.pug',
    lang: 'vue',
    settings: {
      tailwindCSS: {
        classAttributes: ['class'],
      },
    },
    content: html`
      <template>
        <div :class="{'relative flex': true}"></div>
      </template>
    `,
  })

  let classLists = await findClassListsInHtmlRange(file.state, file.doc, 'js')

  expect(classLists).toEqual([
    {
      classList: 'relative flex',
      range: {
        start: { line: 1, character: 17 },
        end: { line: 1, character: 30 },
      },
    },
  ])
})

test('Can find class name inside JS/TS functions in <script> tags (HTML)', async ({ expect }) => {
  let file = createDocument({
    name: 'file.html',
    lang: 'html',
    settings: {
      tailwindCSS: {
        classFunctions: ['clsx'],
      },
    },
    content: html`
      <script>
        let classes = clsx('flex relative')
      </script>
    `,
  })

  let className = await findClassNameAtPosition(file.state, file.doc, {
    line: 1,
    character: 23,
  })

  expect(className).toEqual({
    className: 'flex',
    range: {
      start: { line: 1, character: 22 },
      end: { line: 1, character: 26 },
    },
    relativeRange: {
      start: { line: 0, character: 0 },
      end: { line: 0, character: 4 },
    },
    classList: {
      classList: 'flex relative',
      important: undefined,
      range: {
        start: { character: 22, line: 1 },
        end: { character: 35, line: 1 },
      },
    },
  })
})

test('Can find class name inside JS/TS functions in <script> tags (Svelte)', async ({ expect }) => {
  let file = createDocument({
    name: 'file.svelte',
    lang: 'svelte',
    settings: {
      tailwindCSS: {
        classFunctions: ['clsx'],
      },
    },
    content: html`
      <script>
        let classes = clsx('flex relative')
      </script>
    `,
  })

  let className = await findClassNameAtPosition(file.state, file.doc, {
    line: 1,
    character: 23,
  })

  expect(className).toEqual({
    className: 'flex',
    range: {
      start: { line: 1, character: 22 },
      end: { line: 1, character: 26 },
    },
    relativeRange: {
      start: { line: 0, character: 0 },
      end: { line: 0, character: 4 },
    },
    classList: {
      classList: 'flex relative',
      important: undefined,
      range: {
        start: { character: 22, line: 1 },
        end: { character: 35, line: 1 },
      },
    },
  })
})

test('Can find helper functions in CSS', async ({ expect }) => {
  let file = createDocument({
    name: 'file.css',
    lang: 'css',
    settings: {
      tailwindCSS: {
        classFunctions: ['clsx'],
      },
    },
    content: `
      .a { color: theme(foo); }
      .a { color: theme(foo, default); }
      .a { color: theme("foo"); }
      .a { color: theme("foo", default); }
      .a { color: theme(foo / 0.5); }
      .a { color: theme(foo / 0.5, default); }
      .a { color: theme("foo" / 0.5); }
      .a { color: theme("foo" / 0.5, default); }

      /* nested invocations */
      .a { color: from-config(theme(foo)); }
      .a { color: from-config(theme(foo, default)); }
      .a { color: from-config(theme("foo")); }
      .a { color: from-config(theme("foo", default)); }
      .a { color: from-config(theme(foo / 0.5)); }
      .a { color: from-config(theme(foo / 0.5, default)); }
      .a { color: from-config(theme("foo" / 0.5)); }
      .a { color: from-config(theme("foo" / 0.5, default)); }
    `,
  })

  let fns = findHelperFunctionsInDocument(file.state, file.doc)

  expect(fns).toEqual([
    {
      helper: 'theme',
      path: 'foo',
      ranges: { full: range(1, 24, 1, 27), path: range(1, 24, 1, 27) },
    },
    {
      helper: 'theme',
      path: 'foo',
      ranges: { full: range(2, 24, 2, 36), path: range(2, 24, 2, 27) },
    },
    {
      helper: 'theme',
      path: 'foo',
      ranges: { full: range(3, 24, 3, 29), path: range(3, 25, 3, 28) },
    },
    {
      helper: 'theme',
      path: 'foo',
      ranges: { full: range(4, 24, 4, 38), path: range(4, 25, 4, 28) },
    },
    {
      helper: 'theme',
      path: 'foo',
      ranges: { full: range(5, 24, 5, 33), path: range(5, 24, 5, 27) },
    },
    {
      helper: 'theme',
      path: 'foo',
      ranges: { full: range(6, 24, 6, 42), path: range(6, 24, 6, 27) },
    },
    {
      helper: 'theme',
      path: 'foo',
      ranges: { full: range(7, 24, 7, 35), path: range(7, 25, 7, 28) },
    },
    {
      helper: 'theme',
      path: 'foo',
      ranges: { full: range(8, 24, 8, 44), path: range(8, 25, 8, 28) },
    },

    // Nested
    {
      helper: 'config',
      path: 'theme(foo)',
      ranges: { full: range(11, 30, 11, 40), path: range(11, 30, 11, 40) },
    },
    {
      helper: 'theme',
      path: 'foo',
      ranges: { full: range(11, 36, 11, 39), path: range(11, 36, 11, 39) },
    },
    {
      helper: 'config',
      path: 'theme(foo, default)',
      ranges: { full: range(12, 30, 12, 49), path: range(12, 30, 12, 49) },
    },
    {
      helper: 'theme',
      path: 'foo',
      ranges: { full: range(12, 36, 12, 48), path: range(12, 36, 12, 39) },
    },
    {
      helper: 'config',
      path: 'theme("foo")',
      ranges: { full: range(13, 30, 13, 42), path: range(13, 30, 13, 42) },
    },
    {
      helper: 'theme',
      path: 'foo',
      ranges: { full: range(13, 36, 13, 41), path: range(13, 37, 13, 40) },
    },
    {
      helper: 'config',
      path: 'theme("foo", default)',
      ranges: { full: range(14, 30, 14, 51), path: range(14, 30, 14, 51) },
    },
    {
      helper: 'theme',
      path: 'foo',
      ranges: { full: range(14, 36, 14, 50), path: range(14, 37, 14, 40) },
    },
    {
      helper: 'config',
      path: 'theme(foo / 0.5)',
      ranges: { full: range(15, 30, 15, 46), path: range(15, 30, 15, 46) },
    },
    {
      helper: 'theme',
      path: 'foo',
      ranges: { full: range(15, 36, 15, 45), path: range(15, 36, 15, 39) },
    },
    {
      helper: 'config',
      path: 'theme(foo / 0.5, default)',
      ranges: { full: range(16, 30, 16, 55), path: range(16, 30, 16, 55) },
    },
    {
      helper: 'theme',
      path: 'foo',
      ranges: { full: range(16, 36, 16, 54), path: range(16, 36, 16, 39) },
    },
    {
      helper: 'config',
      path: 'theme("foo" / 0.5)',
      ranges: { full: range(17, 30, 17, 48), path: range(17, 30, 17, 48) },
    },
    {
      helper: 'theme',
      path: 'foo',
      ranges: { full: range(17, 36, 17, 47), path: range(17, 37, 17, 40) },
    },
    {
      helper: 'config',
      path: 'theme("foo" / 0.5, default)',
      ranges: { full: range(18, 30, 18, 57), path: range(18, 30, 18, 57) },
    },
    {
      helper: 'theme',
      path: 'foo',
      ranges: { full: range(18, 36, 18, 56), path: range(18, 37, 18, 40) },
    },
  ])
})
