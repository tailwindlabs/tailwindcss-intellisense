import { createState, getDefaultTailwindSettings, type DocumentClassList } from './state'
import { test } from 'vitest'
import { TextDocument } from 'vscode-languageserver-textdocument'
import { findClassListsInHtmlRange } from './find'

test('test astro', async ({ expect }) => {
  let content = [
    //
    '<a class=`p-4 sm:p-2 ${active ? "underline": "line-through"}`>',
    '  <slot />',
    '</a>',
  ].join('\n')

  let doc = TextDocument.create('file://file.astro', 'astro', 1, content)
  let defaultSettings = getDefaultTailwindSettings()
  let state = createState({
    editor: {
      getConfiguration: async () => ({
        ...defaultSettings,
        tailwindCSS: {
          ...defaultSettings.tailwindCSS,
          classAttributes: ['class'],
          experimental: {
            ...defaultSettings.tailwindCSS.experimental,
            classRegex: [
              ['cva\\(([^)]*)\\)', '["\'`]([^"\'`]*).*?["\'`]'],
              ['cn\\(([^)]*)\\)', '["\'`]([^"\'`]*).*?["\'`]'],
            ],
          },
        },
      }),
    },
  })

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

test('test simple classFunctions', async ({ expect }) => {
  const state = getTailwindSettingsForClassFunctions()
  const classList = `'pointer-events-auto relative flex bg-red-500',
      'items-center justify-between overflow-hidden',
      'md:min-w-[20rem] md:max-w-[37.5rem] md:py-sm py-xs pl-md pr-xs gap-sm w-full',
      'data-[swipe=end]:translate-x-[var(--radix-toast-swipe-end-x)]',
      Date.now() > 15000 ? 'text-red-200' : 'text-red-700',
      'data-[swipe=move]:transition-none',
  `

  const expectedResult: DocumentClassList[] = [
    {
      classList: 'pointer-events-auto relative flex bg-red-500',
      range: {
        start: { character: 7, line: 2 },
        end: { character: 51, line: 2 },
      },
    },
    {
      classList: 'items-center justify-between overflow-hidden',
      range: {
        start: { character: 7, line: 3 },
        end: { character: 51, line: 3 },
      },
    },
    {
      classList: 'md:min-w-[20rem] md:max-w-[37.5rem] md:py-sm py-xs pl-md pr-xs gap-sm w-full',
      range: {
        start: { character: 7, line: 4 },
        end: { character: 83, line: 4 },
      },
    },
    {
      classList: 'data-[swipe=end]:translate-x-[var(--radix-toast-swipe-end-x)]',
      range: {
        start: { line: 5, character: 7 },
        end: { line: 5, character: 68 },
      },
    },
    {
      classList: 'text-red-200',
      range: {
        start: { line: 6, character: 28 },
        end: { line: 6, character: 40 },
      },
    },
    {
      classList: 'text-red-700',
      range: {
        start: { line: 6, character: 45 },
        end: { line: 6, character: 57 },
      },
    },
    {
      classList: 'data-[swipe=move]:transition-none',
      range: {
        start: { line: 7, character: 7 },
        end: { line: 7, character: 40 },
      },
    },
  ]

  const cnContent = `
    const classes = cn(
      ${classList}
    )
  `

  const cnDoc = TextDocument.create('file://file.html', 'html', 1, cnContent)
  const cnClassLists = await findClassListsInHtmlRange(state, cnDoc, 'html')

  expect(cnClassLists).toMatchObject(expectedResult)

  const cvaContent = `
    const classes = cva(
      ${classList}
    )
  `

  const cvaDoc = TextDocument.create('file://file.html', 'html', 1, cvaContent)
  const cvaClassLists = await findClassListsInHtmlRange(state, cvaDoc, 'html')

  expect(cvaClassLists).toMatchObject(expectedResult)

  // Ensure another function name with the same layout doesn't match
  const cmaContent = `
    const classes = cma(
      ${classList}
    )
  `

  const cmaDoc = TextDocument.create('file://file.html', 'html', 1, cmaContent)
  const cmaClassLists = await findClassListsInHtmlRange(state, cmaDoc, 'html')

  expect(cmaClassLists).toMatchObject([])
})

test('test nested classFunctions', async ({ expect }) => {
  const state = getTailwindSettingsForClassFunctions()
  const expectedResult: DocumentClassList[] = [
    {
      classList: 'fixed flex',
      range: {
        start: { line: 3, character: 9 },
        end: { line: 3, character: 19 },
      },
    },
    {
      classList: 'md:h-[calc(100%-2rem)]',
      range: {
        start: { line: 4, character: 9 },
        end: { line: 4, character: 31 },
      },
    },
    {
      classList: 'bg-red-700',
      range: {
        start: { line: 5, character: 9 },
        end: { line: 5, character: 19 },
      },
    },
    {
      classList: 'bottom-0 left-0',
      range: {
        start: { line: 10, character: 22 },
        end: { line: 10, character: 37 },
      },
    },
    {
      classList:
        'inset-0\n              md:h-[calc(100%-2rem)]\n              rounded-none\n            ',
      range: {
        start: { line: 12, character: 14 },
        end: { line: 14, character: 26 },
      },
    },
    {
      classList: 'default',
      range: {
        start: { line: 19, character: 19 },
        end: { line: 19, character: 26 },
      },
    },
  ]

  const content = `
    const variants = cva(
      cn(
        'fixed flex',
        'md:h-[calc(100%-2rem)]',
        'bg-red-700',
      ),
      {
        variants: {
          mobile: {
            default: 'bottom-0 left-0',
            fullScreen: \`
              inset-0
              md:h-[calc(100%-2rem)]
              rounded-none
            \`,
          },
        },
        defaultVariants: {
          mobile: 'default',
        },
      },
    )
  `

  const cnDoc = TextDocument.create('file://file.html', 'html', 1, content)
  const classLists = await findClassListsInHtmlRange(state, cnDoc, 'html')

  expect(classLists).toMatchObject(expectedResult)
})

test('test classFunctions with tagged template literals', async ({ expect }) => {
  const state = getTailwindSettingsForClassFunctions()
  const classList = `pointer-events-auto relative flex bg-red-500
    items-center justify-between overflow-hidden
    md:min-w-[20rem] md:max-w-[37.5rem] md:py-sm pl-md py-xs pr-xs gap-sm w-full
    data-[swipe=end]:translate-x-[var(--radix-toast-swipe-end-x)]
    md:h-[calc(100%-2rem)]
    data-[swipe=move]:transition-none`

  const expectedResult: DocumentClassList[] = [
    {
      classList,
      range: {
        start: { line: 2, character: 6 },
        end: { line: 7, character: 37 },
      },
    },
  ]

  const cnContent = `
    const tagged = cn\`
      ${classList}\`
  `
  const cnDoc = TextDocument.create('file://file.html', 'html', 1, cnContent)
  const cnClassLists = await findClassListsInHtmlRange(state, cnDoc, 'html')

  console.log('cnClassLists', JSON.stringify(cnClassLists, null, 2))

  expect(cnClassLists).toMatchObject(expectedResult)

  const cvaContent = `
    const tagged = cva\`
      ${classList}\`
  `
  const cvaDoc = TextDocument.create('file://file.html', 'html', 1, cvaContent)
  const cvaClassLists = await findClassListsInHtmlRange(state, cvaDoc, 'html')

  expect(cvaClassLists).toMatchObject(expectedResult)

  // Ensure another tag name with the same layout doesn't match
  const cmaContent = `
    const tagged = cma\`
      ${classList}\`
  `

  const cmaDoc = TextDocument.create('file://file.html', 'html', 1, cmaContent)
  const cmaClassLists = await findClassListsInHtmlRange(state, cmaDoc, 'html')

  expect(cmaClassLists).toMatchObject([])
})

function getTailwindSettingsForClassFunctions(): Parameters<typeof findClassListsInHtmlRange>[0] {
  const defaultSettings = getDefaultTailwindSettings()
  return {
    editor: {
      getConfiguration: async () => ({
        ...defaultSettings,
        tailwindCSS: {
          ...defaultSettings.tailwindCSS,
          classFunctions: ['cva', 'cn'],
        },
      }),
    },
  }
}
