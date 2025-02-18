// @ts-check
import { test } from 'vitest'
import { init } from '../common'

test('Unknown languages do not provide completions', async ({ expect }) => {
  let { client } = await init('basic')

  let doc = await client.open({
    lang: 'some-lang',
    text: '<div class="bg-[#000]">',
  })

  let hover = await doc.hover({ line: 0, character: 13 })

  expect(hover).toEqual(null)

  let completion = await doc.completions({
    position: { line: 0, character: 13 },
    context: { triggerKind: 1 },
  })

  expect(completion).toBe(null)
})

test('Custom languages may be specified via init options (deprecated)', async ({ expect }) => {
  let { client } = await init('basic', {
    options: {
      userLanguages: {
        'some-lang': 'html',
      },
    },
  })

  let doc = await client.open({
    lang: 'some-lang',
    text: '<div class="bg-[#000]">',
  })

  let hover = await doc.hover({ line: 0, character: 13 })

  expect(hover).toEqual({
    contents: {
      language: 'css',
      value:
        '.bg-\\[\\#000\\] {\n  --tw-bg-opacity: 1;\n  background-color: rgb(0 0 0 / var(--tw-bg-opacity, 1)) /* #000000 */;\n}',
    },
    range: { start: { line: 0, character: 12 }, end: { line: 0, character: 21 } },
  })

  let completion = await doc.completions({
    position: { line: 0, character: 13 },
    context: { triggerKind: 1 },
  })

  expect(completion?.items.length).toBe(11509)
})

test('Custom languages may be specified via settings', async ({ expect }) => {
  let { client } = await init('basic', {
    settings: {
      tailwindCSS: {
        includeLanguages: {
          'some-lang': 'html',
        },
      },
    },
  })

  let doc = await client.open({
    lang: 'some-lang',
    text: '<div class="bg-[#000]">',
  })

  let hover = await doc.hover({ line: 0, character: 13 })

  expect(hover).toEqual({
    contents: {
      language: 'css',
      value:
        '.bg-\\[\\#000\\] {\n  --tw-bg-opacity: 1;\n  background-color: rgb(0 0 0 / var(--tw-bg-opacity, 1)) /* #000000 */;\n}',
    },
    range: { start: { line: 0, character: 12 }, end: { line: 0, character: 21 } },
  })

  let completion = await doc.completions({
    position: { line: 0, character: 13 },
    context: { triggerKind: 1 },
  })

  expect(completion?.items.length).toBe(11509)
})

test('Custom languages are merged from init options and settings', async ({ expect }) => {
  let { client } = await init('basic', {
    options: {
      userLanguages: {
        'some-lang': 'html',
      },
    },

    settings: {
      tailwindCSS: {
        includeLanguages: {
          'other-lang': 'html',
        },
      },
    },
  })

  let doc = await client.open({
    lang: 'some-lang',
    text: '<div class="bg-[#000]">',
  })

  let hover = await doc.hover({ line: 0, character: 13 })

  let completion = await doc.completions({
    position: { line: 0, character: 13 },
    context: { triggerKind: 1 },
  })

  let doc2 = await client.open({
    lang: 'other-lang',
    text: '<div class="bg-[#000]">',
  })

  let hover2 = await doc2.hover({ line: 0, character: 13 })

  let completion2 = await doc2.completions({
    position: { line: 0, character: 13 },
    context: { triggerKind: 1 },
  })

  expect(hover).toEqual({
    contents: {
      language: 'css',
      value:
        '.bg-\\[\\#000\\] {\n  --tw-bg-opacity: 1;\n  background-color: rgb(0 0 0 / var(--tw-bg-opacity, 1)) /* #000000 */;\n}',
    },
    range: { start: { line: 0, character: 12 }, end: { line: 0, character: 21 } },
  })

  expect(hover2).toEqual({
    contents: {
      language: 'css',
      value:
        '.bg-\\[\\#000\\] {\n  --tw-bg-opacity: 1;\n  background-color: rgb(0 0 0 / var(--tw-bg-opacity, 1)) /* #000000 */;\n}',
    },
    range: { start: { line: 0, character: 12 }, end: { line: 0, character: 21 } },
  })

  expect(completion?.items.length).toBe(11509)
  expect(completion2?.items.length).toBe(11509)
})

test('Language mappings from settings take precedence', async ({ expect }) => {
  let { client } = await init('basic', {
    options: {
      userLanguages: {
        'some-lang': 'css',
      },
    },

    settings: {
      tailwindCSS: {
        includeLanguages: {
          'some-lang': 'html',
        },
      },
    },
  })

  let doc = await client.open({
    lang: 'some-lang',
    text: '<div class="bg-[#000]">',
  })

  let hover = await doc.hover({ line: 0, character: 13 })

  expect(hover).toEqual({
    contents: {
      language: 'css',
      value:
        '.bg-\\[\\#000\\] {\n  --tw-bg-opacity: 1;\n  background-color: rgb(0 0 0 / var(--tw-bg-opacity, 1)) /* #000000 */;\n}',
    },
    range: { start: { line: 0, character: 12 }, end: { line: 0, character: 21 } },
  })

  let completion = await doc.completions({
    position: { line: 0, character: 13 },
    context: { triggerKind: 1 },
  })

  expect(completion?.items.length).toBe(11509)
})
