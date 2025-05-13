import { test } from 'vitest'
import { withFixture } from '../common'

withFixture('dependencies', (c) => {
  async function completion({
    lang,
    text,
    position,
    context = {
      triggerKind: 1,
    },
    settings,
  }) {
    let textDocument = await c.openDocument({ text, lang, settings })

    return c.sendRequest('textDocument/completion', {
      textDocument,
      position,
      context,
    })
  }

  test.concurrent('@config', async ({ expect }) => {
    let result = await completion({
      text: '@config "',
      lang: 'css',
      position: {
        line: 0,
        character: 9,
      },
    })

    expect(result).toEqual({
      isIncomplete: false,
      items: [
        {
          label: 'sub-dir/',
          kind: 19,
          command: { command: 'editor.action.triggerSuggest', title: '' },
          data: expect.anything(),
          textEdit: {
            newText: 'sub-dir/',
            range: { start: { line: 0, character: 9 }, end: { line: 0, character: 9 } },
          },
        },
        {
          label: 'tailwind.config.js',
          kind: 17,
          data: expect.anything(),
          textEdit: {
            newText: 'tailwind.config.js',
            range: { start: { line: 0, character: 9 }, end: { line: 0, character: 9 } },
          },
        },
      ],
    })
  })

  test.concurrent('@config directory', async ({ expect }) => {
    let result = await completion({
      text: '@config "./sub-dir/',
      lang: 'css',
      position: {
        line: 0,
        character: 19,
      },
    })

    expect(result).toEqual({
      isIncomplete: false,
      items: [
        {
          label: 'colors.js',
          kind: 17,
          data: expect.anything(),
          textEdit: {
            newText: 'colors.js',
            range: { start: { line: 0, character: 19 }, end: { line: 0, character: 19 } },
          },
        },
      ],
    })
  })
})

withFixture('v4/dependencies', (c) => {
  async function completion({
    lang,
    text,
    position,
    context = {
      triggerKind: 1,
    },
    settings,
  }) {
    let textDocument = await c.openDocument({ text, lang, settings })

    return c.sendRequest('textDocument/completion', {
      textDocument,
      position,
      context,
    })
  }

  test.concurrent('@config', async ({ expect }) => {
    let result = await completion({
      text: '@config "',
      lang: 'css',
      position: {
        line: 0,
        character: 9,
      },
    })

    expect(result).toEqual({
      isIncomplete: false,
      items: [
        {
          label: 'sub-dir/',
          kind: 19,
          command: { command: 'editor.action.triggerSuggest', title: '' },
          data: expect.anything(),
          textEdit: {
            newText: 'sub-dir/',
            range: { start: { line: 0, character: 9 }, end: { line: 0, character: 9 } },
          },
        },
        {
          label: 'tailwind.config.js',
          kind: 17,
          data: expect.anything(),
          textEdit: {
            newText: 'tailwind.config.js',
            range: { start: { line: 0, character: 9 }, end: { line: 0, character: 9 } },
          },
        },
      ],
    })
  })

  test.concurrent('@config directory', async ({ expect }) => {
    let result = await completion({
      text: '@config "./sub-dir/',
      lang: 'css',
      position: {
        line: 0,
        character: 19,
      },
    })

    expect(result).toEqual({
      isIncomplete: false,
      items: [
        {
          label: 'colors.js',
          kind: 17,
          data: expect.anything(),
          textEdit: {
            newText: 'colors.js',
            range: { start: { line: 0, character: 19 }, end: { line: 0, character: 19 } },
          },
        },
      ],
    })
  })

  test.concurrent('@plugin', async ({ expect }) => {
    let result = await completion({
      text: '@plugin "',
      lang: 'css',
      position: {
        line: 0,
        character: 9,
      },
    })

    expect(result).toEqual({
      isIncomplete: false,
      items: [
        {
          label: 'sub-dir/',
          kind: 19,
          command: { command: 'editor.action.triggerSuggest', title: '' },
          data: expect.anything(),
          textEdit: {
            newText: 'sub-dir/',
            range: { start: { line: 0, character: 9 }, end: { line: 0, character: 9 } },
          },
        },
        {
          label: 'tailwind.config.js',
          kind: 17,
          data: expect.anything(),
          textEdit: {
            newText: 'tailwind.config.js',
            range: { start: { line: 0, character: 9 }, end: { line: 0, character: 9 } },
          },
        },
      ],
    })
  })

  test.concurrent('@plugin directory', async ({ expect }) => {
    let result = await completion({
      text: '@plugin "./sub-dir/',
      lang: 'css',
      position: {
        line: 0,
        character: 19,
      },
    })

    expect(result).toEqual({
      isIncomplete: false,
      items: [
        {
          label: 'colors.js',
          kind: 17,
          data: expect.anything(),
          textEdit: {
            newText: 'colors.js',
            range: { start: { line: 0, character: 19 }, end: { line: 0, character: 19 } },
          },
        },
      ],
    })
  })

  test.concurrent('@source', async ({ expect }) => {
    let result = await completion({
      text: '@source "',
      lang: 'css',
      position: {
        line: 0,
        character: 9,
      },
    })

    expect(result).toEqual({
      isIncomplete: false,
      items: [
        {
          label: 'index.html',
          kind: 17,
          data: expect.anything(),
          textEdit: {
            newText: 'index.html',
            range: { start: { line: 0, character: 9 }, end: { line: 0, character: 9 } },
          },
        },
        {
          label: 'sub-dir/',
          kind: 19,
          command: { command: 'editor.action.triggerSuggest', title: '' },
          data: expect.anything(),
          textEdit: {
            newText: 'sub-dir/',
            range: { start: { line: 0, character: 9 }, end: { line: 0, character: 9 } },
          },
        },
        {
          label: 'tailwind.config.js',
          kind: 17,
          data: expect.anything(),
          textEdit: {
            newText: 'tailwind.config.js',
            range: { start: { line: 0, character: 9 }, end: { line: 0, character: 9 } },
          },
        },
      ],
    })
  })

  test.concurrent('@source not', async ({ expect }) => {
    let result = await completion({
      text: '@source not "',
      lang: 'css',
      position: {
        line: 0,
        character: 13,
      },
    })

    expect(result).toEqual({
      isIncomplete: false,
      items: [
        {
          label: 'index.html',
          kind: 17,
          data: expect.anything(),
          textEdit: {
            newText: 'index.html',
            range: { start: { line: 0, character: 13 }, end: { line: 0, character: 13 } },
          },
        },
        {
          label: 'sub-dir/',
          kind: 19,
          command: { command: 'editor.action.triggerSuggest', title: '' },
          data: expect.anything(),
          textEdit: {
            newText: 'sub-dir/',
            range: { start: { line: 0, character: 13 }, end: { line: 0, character: 13 } },
          },
        },
        {
          label: 'tailwind.config.js',
          kind: 17,
          data: expect.anything(),
          textEdit: {
            newText: 'tailwind.config.js',
            range: { start: { line: 0, character: 13 }, end: { line: 0, character: 13 } },
          },
        },
      ],
    })
  })

  test.concurrent('@source directory', async ({ expect }) => {
    let result = await completion({
      text: '@source "./sub-dir/',
      lang: 'css',
      position: {
        line: 0,
        character: 19,
      },
    })

    expect(result).toEqual({
      isIncomplete: false,
      items: [
        {
          label: 'colors.js',
          kind: 17,
          data: expect.anything(),
          textEdit: {
            newText: 'colors.js',
            range: { start: { line: 0, character: 19 }, end: { line: 0, character: 19 } },
          },
        },
      ],
    })
  })

  test.concurrent('@source not directory', async ({ expect }) => {
    let result = await completion({
      text: '@source not "./sub-dir/',
      lang: 'css',
      position: {
        line: 0,
        character: 23,
      },
    })

    expect(result).toEqual({
      isIncomplete: false,
      items: [
        {
          label: 'colors.js',
          kind: 17,
          data: expect.anything(),
          textEdit: {
            newText: 'colors.js',
            range: { start: { line: 0, character: 23 }, end: { line: 0, character: 23 } },
          },
        },
      ],
    })
  })

  test.concurrent('@source inline(…)', async ({ expect }) => {
    let result = await completion({
      text: '@source inline("',
      lang: 'css',
      position: {
        line: 0,
        character: 16,
      },
    })

    expect(result).toEqual(null)
  })

  test.concurrent('@source not inline(…)', async ({ expect }) => {
    let result = await completion({
      text: '@source not inline("',
      lang: 'css',
      position: {
        line: 0,
        character: 20,
      },
    })

    expect(result).toEqual(null)
  })

  test.concurrent('@import "…" source(…)', async ({ expect }) => {
    let result = await completion({
      text: '@import "tailwindcss" source("',
      lang: 'css',
      position: {
        line: 0,
        character: 30,
      },
    })

    expect(result).toEqual({
      isIncomplete: false,
      items: [
        {
          label: 'sub-dir/',
          kind: 19,
          command: { command: 'editor.action.triggerSuggest', title: '' },
          data: expect.anything(),
          textEdit: {
            newText: 'sub-dir/',
            range: { start: { line: 0, character: 30 }, end: { line: 0, character: 30 } },
          },
        },
      ],
    })
  })

  test.concurrent('@tailwind utilities source(…)', async ({ expect }) => {
    let result = await completion({
      text: '@tailwind utilities source("',
      lang: 'css',
      position: {
        line: 0,
        character: 28,
      },
    })

    expect(result).toEqual({
      isIncomplete: false,
      items: [
        {
          label: 'sub-dir/',
          kind: 19,
          command: { command: 'editor.action.triggerSuggest', title: '' },
          data: expect.anything(),
          textEdit: {
            newText: 'sub-dir/',
            range: { start: { line: 0, character: 28 }, end: { line: 0, character: 28 } },
          },
        },
      ],
    })
  })

  test.concurrent('@import "…" source(…) directory', async ({ expect }) => {
    let result = await completion({
      text: '@import "tailwindcss" source("sub-dir/',
      lang: 'css',
      position: {
        line: 0,
        character: 38,
      },
    })

    expect(result).toEqual({
      isIncomplete: false,
      items: [],
    })
  })

  test.concurrent('@tailwind utilities source(…) directory', async ({ expect }) => {
    let result = await completion({
      text: '@tailwind utilities source("sub-dir/',
      lang: 'css',
      position: {
        line: 0,
        character: 36,
      },
    })

    expect(result).toEqual({
      isIncomplete: false,
      items: [],
    })
  })
})
