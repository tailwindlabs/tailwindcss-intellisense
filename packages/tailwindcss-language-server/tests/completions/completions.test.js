import { expect, test } from 'vitest'
import { withFixture } from '../common'

withFixture('basic', (c) => {
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

  async function expectCompletions({ lang, text, position, settings }) {
    let result = await completion({ lang, text, position, settings })
    let textEdit = expect.objectContaining({ range: { start: position, end: position } })

    expect(result.items.length).toBe(11175)
    expect(result.items.filter((item) => item.label.endsWith(':')).length).toBe(157)
    expect(result).toEqual({
      isIncomplete: false,
      items: expect.arrayContaining([
        expect.objectContaining({ label: 'hover:', textEdit }),
        expect.objectContaining({ label: 'uppercase', textEdit }),
      ]),
    })
  }

  test.concurrent('HTML', async () => {
    await expectCompletions({ text: '<div class=""></div>', position: { line: 0, character: 12 } })
  })

  test.concurrent('JSX', async () => {
    await expectCompletions({
      lang: 'javascriptreact',
      text: "<div className={''}></div>",
      position: {
        line: 0,
        character: 17,
      },
    })
  })

  test.concurrent('JSX concatination', async () => {
    await expectCompletions({
      lang: 'javascriptreact',
      text: "<div className={'' + ''}></div>",
      position: {
        line: 0,
        character: 22,
      },
    })
  })

  test.concurrent('JSX outside strings', async () => {
    let result = await completion({
      lang: 'javascriptreact',
      text: "<div className={'' + ''}></div>",
      position: {
        line: 0,
        character: 18,
      },
    })
    expect(result).toBe(null)
  })

  test.concurrent('classRegex simple', async () => {
    await expectCompletions({
      text: 'test ',
      position: {
        line: 0,
        character: 5,
      },
      settings: { tailwindCSS: { experimental: { classRegex: ['test (\\S*)'] } } },
    })
  })

  test.concurrent('classRegex nested', async () => {
    await expectCompletions({
      text: 'test ""',
      position: {
        line: 0,
        character: 6,
      },
      settings: {
        tailwindCSS: { experimental: { classRegex: [['test (\\S*)', '"([^"]*)"']] } },
      },
    })
  })

  test.concurrent('resolve', async () => {
    let result = await completion({
      text: '<div class="">',
      position: {
        line: 0,
        character: 12,
      },
    })

    let item = result.items.find((item) => item.label === 'uppercase')
    let resolved = await c.sendRequest('completionItem/resolve', item)

    expect(resolved).toEqual({
      ...item,
      detail: 'text-transform: uppercase;',
      documentation: {
        kind: 'markdown',
        value: '```css\n.uppercase {\n  text-transform: uppercase;\n}\n```',
      },
    })
  })
})
