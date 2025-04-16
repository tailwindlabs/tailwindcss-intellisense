import { test, expect, describe } from 'vitest'
import { ClientOptions, createClient } from '../utils/client'
import { css, range } from '../utils/utils'
import { CompletionItem } from 'vscode-languageserver'
import { Position } from 'vscode-languageserver-textdocument'

interface CompletionFixture {
  name: string
  client?: ClientOptions
  lang?: string
  text: string
  position: Position
  expected: CompletionItem[]
}

describe('v4', async () => {
  let client = await createClient({
    config: {
      kind: 'css',
      content: css`
        /* */
      `,
    },
    fs: {
      'index.html': '',
      'sub-dir/colors.js': '',
      'tailwind.config.js': '',
    },
  })

  function runTest({
    client: clientOpts,
    name,
    lang = 'html',
    text,
    position,
    expected,
  }: CompletionFixture) {
    test(name, async () => {
      let testClient = clientOpts ? await createClient(clientOpts) : client
      let doc = await testClient.open({ lang, text })
      let list = await doc.completions(position)
      expect(list?.items ?? null).toEqual(expected)
    })
  }

  runTest({
    name: '@config',
    lang: 'css',
    text: css`@config "`,
    position: { line: 0, character: 9 },
    expected: [
      {
        label: 'sub-dir/',
        kind: 19,
        command: { command: 'editor.action.triggerSuggest', title: '' },
        data: expect.anything(),
        textEdit: {
          range: range(0, 9, 0, 9),
          newText: 'sub-dir/',
        },
      },
      {
        label: 'tailwind.config.js',
        kind: 17,
        data: expect.anything(),
        textEdit: {
          range: range(0, 9, 0, 9),
          newText: 'tailwind.config.js',
        },
      },
    ],
  })

  runTest({
    name: '@config directory',
    lang: 'css',
    text: css`@config "./sub-dir/`,
    position: { line: 0, character: 19 },
    expected: [
      {
        label: 'colors.js',
        kind: 17,
        data: expect.anything(),
        textEdit: {
          newText: 'colors.js',
          range: range(0, 19, 0, 19),
        },
      },
    ],
  })

  runTest({
    name: '@plugin',
    lang: 'css',
    text: css`@plugin "`,
    position: { line: 0, character: 9 },
    expected: [
      {
        label: 'sub-dir/',
        kind: 19,
        command: { command: 'editor.action.triggerSuggest', title: '' },
        data: expect.anything(),
        textEdit: {
          newText: 'sub-dir/',
          range: range(0, 9, 0, 9),
        },
      },
      {
        label: 'tailwind.config.js',
        kind: 17,
        data: expect.anything(),
        textEdit: {
          newText: 'tailwind.config.js',
          range: range(0, 9, 0, 9),
        },
      },
    ],
  })

  runTest({
    name: '@plugin directory',
    lang: 'css',
    text: css`@plugin "./sub-dir/`,
    position: { line: 0, character: 19 },
    expected: [
      {
        label: 'colors.js',
        kind: 17,
        data: expect.anything(),
        textEdit: {
          newText: 'colors.js',
          range: range(0, 19, 0, 19),
        },
      },
    ],
  })

  runTest({
    name: '@source',
    lang: 'css',
    text: css`@source "`,
    position: { line: 0, character: 9 },
    expected: [
      {
        label: 'index.html',
        kind: 17,
        data: expect.anything(),
        textEdit: {
          newText: 'index.html',
          range: range(0, 9, 0, 9),
        },
      },
      {
        label: 'sub-dir/',
        kind: 19,
        command: { command: 'editor.action.triggerSuggest', title: '' },
        data: expect.anything(),
        textEdit: {
          newText: 'sub-dir/',
          range: range(0, 9, 0, 9),
        },
      },
      {
        label: 'tailwind.config.js',
        kind: 17,
        data: expect.anything(),
        textEdit: {
          newText: 'tailwind.config.js',
          range: range(0, 9, 0, 9),
        },
      },
    ],
  })

  runTest({
    name: '@source not',
    lang: 'css',
    text: css`@source not "`,
    position: { line: 0, character: 13 },
    expected: [
      {
        label: 'index.html',
        kind: 17,
        data: expect.anything(),
        textEdit: {
          newText: 'index.html',
          range: range(0, 13, 0, 13),
        },
      },
      {
        label: 'sub-dir/',
        kind: 19,
        command: { command: 'editor.action.triggerSuggest', title: '' },
        data: expect.anything(),
        textEdit: {
          newText: 'sub-dir/',
          range: range(0, 13, 0, 13),
        },
      },
      {
        label: 'tailwind.config.js',
        kind: 17,
        data: expect.anything(),
        textEdit: {
          newText: 'tailwind.config.js',
          range: range(0, 13, 0, 13),
        },
      },
    ],
  })

  runTest({
    name: '@source directory',
    lang: 'css',
    text: css`@source "./sub-dir/`,
    position: { line: 0, character: 19 },
    expected: [
      {
        label: 'colors.js',
        kind: 17,
        data: expect.anything(),
        textEdit: {
          newText: 'colors.js',
          range: range(0, 19, 0, 19),
        },
      },
    ],
  })

  runTest({
    name: '@source not',
    lang: 'css',
    text: css`@source not "./sub-dir/`,
    position: { line: 0, character: 23 },
    expected: [
      {
        label: 'colors.js',
        kind: 17,
        data: expect.anything(),
        textEdit: {
          newText: 'colors.js',
          range: range(0, 23, 0, 23),
        },
      },
    ],
  })

  runTest({
    name: '@source inline',
    lang: 'css',
    text: css`@source inline("`,
    position: { line: 0, character: 16 },
    expected: null,
  })

  runTest({
    name: '@source not',
    lang: 'css',
    text: css`@source not inline("`,
    position: { line: 0, character: 20 },
    expected: null,
  })

  runTest({
    name: '@import "…"',
    lang: 'css',
    text: css`@import "tailwindcss" source("`,
    position: { line: 0, character: 30 },
    expected: [
      {
        label: 'sub-dir/',
        kind: 19,
        command: { command: 'editor.action.triggerSuggest', title: '' },
        data: expect.anything(),
        textEdit: {
          newText: 'sub-dir/',
          range: range(0, 30, 0, 30),
        },
      },
    ],
  })

  runTest({
    name: '@tailwind utilities',
    lang: 'css',
    text: css`@tailwind utilities source("`,
    position: { line: 0, character: 28 },
    expected: [
      {
        label: 'sub-dir/',
        kind: 19,
        command: { command: 'editor.action.triggerSuggest', title: '' },
        data: expect.anything(),
        textEdit: {
          newText: 'sub-dir/',
          range: range(0, 28, 0, 28),
        },
      },
    ],
  })

  runTest({
    name: '@import "…"',
    lang: 'css',
    text: css`@import "tailwindcss" source("sub-dir/`,
    position: { line: 0, character: 38 },
    expected: [],
  })

  runTest({
    name: '@tailwind utilities',
    lang: 'css',
    text: css`@tailwind utilities source("sub-dir/`,
    position: { line: 0, character: 36 },
    expected: [],
  })
})
