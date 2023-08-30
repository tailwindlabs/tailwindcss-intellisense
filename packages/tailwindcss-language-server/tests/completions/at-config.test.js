import { expect, test } from 'vitest'
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

  test.concurrent('@config', async () => {
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

  test.concurrent('@config directory', async () => {
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
