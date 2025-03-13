import { createState, getDefaultTailwindSettings, Settings, type DocumentClassList } from './state'
import { test } from 'vitest'
import { TextDocument } from 'vscode-languageserver-textdocument'
import { findClassListsInHtmlRange } from './find'
import type { DeepPartial } from '../types'
import dedent from 'dedent'

const js = dedent

test('class regex works in astro', async ({ expect }) => {
  let { doc, state } = createDocument({
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

  let classLists = await findClassListsInHtmlRange(state, doc, 'html')

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
    lang: 'javascript',
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
    lang: 'javascript',
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
  let fileA = createDocument({
    name: 'file.jsx',
    lang: 'javascript',
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

  let classLists = await findClassListsInHtmlRange(fileA.state, fileA.doc, 'html')

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

    // TODO: These duplicates are from matching nested clsx(…) and should be ignored
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

test('find class lists in nested fn calls (only nested matches)', async ({ expect }) => {
  let fileA = createDocument({
    name: 'file.jsx',
    lang: 'javascript',
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

  let classLists = await findClassListsInHtmlRange(fileA.state, fileA.doc, 'html')

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
    lang: 'javascript',
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
    lang: 'javascript',
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

function createDocument({
  name,
  lang,
  content,
  settings,
}: {
  name: string
  lang: string
  content: string | string[]
  settings: DeepPartial<Settings>
}) {
  let doc = TextDocument.create(
    `file://${name}`,
    lang,
    1,
    typeof content === 'string' ? content : content.join('\n'),
  )
  let defaults = getDefaultTailwindSettings()
  let state = createState({
    editor: {
      // @ts-ignore
      getConfiguration: async () => ({
        ...defaults,
        ...settings,
        tailwindCSS: {
          ...defaults.tailwindCSS,
          ...settings.tailwindCSS,
          lint: {
            ...defaults.tailwindCSS.lint,
            ...(settings.tailwindCSS?.lint ?? {}),
          },
          experimental: {
            ...defaults.tailwindCSS.experimental,
            ...(settings.tailwindCSS?.experimental ?? {}),
          },
          files: {
            ...defaults.tailwindCSS.files,
            ...(settings.tailwindCSS?.files ?? {}),
          },
        },
        editor: {
          ...defaults.editor,
          ...settings.editor,
        },
      }),
    },
  })

  return {
    doc,
    state,
  }
}
