import type { State } from './state'
import { test } from 'vitest'
import { TextDocument } from 'vscode-languageserver-textdocument'
import { findClassListsInHtmlRange } from './find'

test('test', async ({ expect }) => {
  let content = [
    //
    '<a class=`p-4 sm:p-2 ${active ? "underline": "line-through"}`>',
    '  <slot />',
    '</a>',
  ].join('\n')

  let doc = TextDocument.create('file://file.astro', 'astro', 1, content)
  let state: State = {
    blocklist: [],
    editor: {
      userLanguages: {},
      getConfiguration: async () => ({
        editor: {
          tabSize: 1,
        },
        tailwindCSS: {
          classAttributes: ['class'],
          experimental: {
            classRegex: [
              ['cva\\(([^)]*)\\)', '["\'`]([^"\'`]*).*?["\'`]'],
              ['cn\\(([^)]*)\\)', '["\'`]([^"\'`]*).*?["\'`]'],
            ],
          },
        } as any,
      }),
    } as any,
  } as any

  let classLists = await findClassListsInHtmlRange(state, doc, 'html')

  expect(classLists).toMatchInlineSnapshot(`
    [
      {
        "classList": "p-4 sm:p-2 $",
        "range": {
          "end": {
            "character": 22,
            "line": 0,
          },
          "start": {
            "character": 10,
            "line": 0,
          },
        },
      },
      {
        "classList": "underline",
        "range": {
          "end": {
            "character": 42,
            "line": 0,
          },
          "start": {
            "character": 33,
            "line": 0,
          },
        },
      },
      {
        "classList": "line-through",
        "range": {
          "end": {
            "character": 58,
            "line": 0,
          },
          "start": {
            "character": 46,
            "line": 0,
          },
        },
      },
    ]
  `)
})
