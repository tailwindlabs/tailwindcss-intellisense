import { expect, test } from 'vitest'
import { withFixture } from '../common'

function buildCompletion(c) {
  return async function completion({
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
}

withFixture('basic', (c) => {
  let completion = buildCompletion(c)

  async function expectCompletions({ lang, text, position, settings }) {
    let result = await completion({ lang, text, position, settings })
    let textEdit = expect.objectContaining({ range: { start: position, end: position } })

    expect(result.items.length).toBe(11448)
    expect(result.items.filter((item) => item.label.endsWith(':')).length).toBe(165)
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

  test.concurrent('classRegex simple (no matches)', async () => {
    let result = await completion({
      text: 'tron ',
      position: {
        line: 0,
        character: 5,
      },
      settings: { tailwindCSS: { experimental: { classRegex: ['test (\\S*)'] } } },
    })

    expect(result).toBe(null)
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

  test.concurrent('classRegex nested (no matches, container)', async () => {
    let result = await completion({
      text: 'tron ""',
      position: {
        line: 0,
        character: 6,
      },
      settings: {
        tailwindCSS: { experimental: { classRegex: [['test (\\S*)', '"([^"]*)"']] } },
      },
    })

    expect(result).toBe(null)
  })

  test.concurrent('classRegex nested (no matches, class)', async () => {
    let result = await completion({
      text: 'test ``',
      position: {
        line: 0,
        character: 6,
      },
      settings: {
        tailwindCSS: { experimental: { classRegex: [['test (\\S*)', '"([^"]*)"']] } },
      },
    })

    expect(result).toBe(null)
  })

  test.concurrent('classRegex matching empty string', async () => {
    try {
      let result = await completion({
        text: "let _ = ''",
        position: {
          line: 0,
          character: 18,
        },
        settings: {
          tailwindCSS: { experimental: { classRegex: [["(?<=')(\\w*)(?=')"]] } },
        },
      })
      expect(result).toBe(null)
    } catch (err) {
      console.log(err.toJson())
      throw err
    }

    let result2 = await completion({
      text: "let _ = ''; let _2 = 'text-",
      position: {
        line: 0,
        character: 27,
      },
      settings: {
        tailwindCSS: { experimental: { classRegex: [["(?<=')(\\w*)(?=')"]] } },
      },
    })

    expect(result2).toBe(null)
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

withFixture('overrides-variants', (c) => {
  let completion = buildCompletion(c)

  test.concurrent(
    'duplicate variant + value pairs do not produce multiple completions',
    async () => {
      let result = await completion({
        text: '<div class="custom-hover"></div>',
        position: { line: 0, character: 23 },
      })

      expect(result.items.filter((item) => item.label.endsWith('custom-hover:')).length).toBe(1)
    }
  )
})
