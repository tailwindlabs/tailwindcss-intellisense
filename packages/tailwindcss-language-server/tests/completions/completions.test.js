import { test } from 'vitest'
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
    dir = '',
  }) {
    let textDocument = await c.openDocument({ text, lang, settings, dir })

    return c.sendRequest('textDocument/completion', {
      textDocument,
      position,
      context,
    })
  }
}

withFixture('basic', (c) => {
  let completion = buildCompletion(c)

  async function expectCompletions({ expect, lang, text, position, settings }) {
    let result = await completion({ lang, text, position, settings })
    let textEdit = expect.objectContaining({ range: { start: position, end: position } })

    expect(result.items.length).toBe(11509)
    expect(result.items.filter((item) => item.label.endsWith(':')).length).toBe(165)
    expect(result).toEqual({
      isIncomplete: false,
      items: expect.arrayContaining([
        expect.objectContaining({ label: 'hover:', textEdit }),
        expect.objectContaining({ label: 'uppercase', textEdit }),
      ]),
    })
  }

  test.concurrent('HTML', async ({ expect }) => {
    await expectCompletions({
      expect,
      text: '<div class=""></div>',
      position: { line: 0, character: 12 },
    })
  })

  test.concurrent('JSX', async ({ expect }) => {
    await expectCompletions({
      expect,
      lang: 'javascriptreact',
      text: "<div className={''}></div>",
      position: {
        line: 0,
        character: 17,
      },
    })
  })

  test.concurrent('JSX concatination', async ({ expect }) => {
    await expectCompletions({
      expect,
      lang: 'javascriptreact',
      text: "<div className={'' + ''}></div>",
      position: {
        line: 0,
        character: 22,
      },
    })
  })

  test.concurrent('JSX outside strings', async ({ expect }) => {
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

  test.concurrent('classRegex simple', async ({ expect }) => {
    await expectCompletions({
      expect,
      text: 'test ',
      position: {
        line: 0,
        character: 5,
      },
      settings: { tailwindCSS: { experimental: { classRegex: ['test (\\S*)'] } } },
    })
  })

  test.concurrent('classRegex simple (no matches)', async ({ expect }) => {
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

  test.concurrent('classRegex nested', async ({ expect }) => {
    await expectCompletions({
      expect,
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

  test.concurrent('classRegex nested (no matches, container)', async ({ expect }) => {
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

  test.concurrent('classRegex nested (no matches, class)', async ({ expect }) => {
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

  test.concurrent('classRegex matching empty string', async ({ expect }) => {
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

  test.concurrent('resolve', async ({ expect }) => {
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

withFixture('basic', (c) => {
  let completion = buildCompletion(c)

  test('Completions have default pixel equivalents (1rem == 16px)', async ({ expect }) => {
    let result = await completion({
      lang: 'html',
      text: '<div class=""></div>',
      position: { line: 0, character: 12 },
    })

    let item = result.items.find((item) => item.label === 'text-sm')
    let resolved = await c.sendRequest('completionItem/resolve', item)

    expect(resolved).toEqual({
      ...item,
      detail: 'font-size: 0.875rem /* 14px */; line-height: 1.25rem /* 20px */;',
      documentation: {
        kind: 'markdown',
        value:
          '```css\n.text-sm {\n  font-size: 0.875rem /* 14px */;\n  line-height: 1.25rem /* 20px */;\n}\n```',
      },
    })
  })
})

withFixture('basic', (c) => {
  let completion = buildCompletion(c)

  test('Completions have customizable pixel equivalents (1rem == 10px)', async ({ expect }) => {
    await c.updateSettings({
      tailwindCSS: {
        rootFontSize: 10,
      },
    })

    let result = await completion({
      lang: 'html',
      text: '<div class=""></div>',
      position: { line: 0, character: 12 },
    })

    let item = result.items.find((item) => item.label === 'text-sm')

    let resolved = await c.sendRequest('completionItem/resolve', item)

    expect(resolved).toEqual({
      ...item,
      detail: 'font-size: 0.875rem /* 8.75px */; line-height: 1.25rem /* 12.5px */;',
      documentation: {
        kind: 'markdown',
        value:
          '```css\n.text-sm {\n  font-size: 0.875rem /* 8.75px */;\n  line-height: 1.25rem /* 12.5px */;\n}\n```',
      },
    })
  })
})

withFixture('basic', (c) => {
  let completion = buildCompletion(c)

  test('Completions have color equivalents presented as hex', async ({ expect }) => {
    let result = await completion({
      lang: 'html',
      text: '<div class=""></div>',
      position: { line: 0, character: 12 },
    })

    let item = result.items.find((item) => item.label === 'bg-red-500')

    let resolved = await c.sendRequest('completionItem/resolve', item)

    expect(resolved).toEqual({
      ...item,
      detail: '--tw-bg-opacity: 1; background-color: rgb(239 68 68 / var(--tw-bg-opacity));',
      documentation: '#ef4444',
    })
  })
})

withFixture('overrides-variants', (c) => {
  let completion = buildCompletion(c)

  test.concurrent(
    'duplicate variant + value pairs do not produce multiple completions',
    async ({ expect }) => {
      let result = await completion({
        text: '<div class="custom-hover"></div>',
        position: { line: 0, character: 23 },
      })

      expect(result.items.filter((item) => item.label.endsWith('custom-hover:')).length).toBe(1)
    },
  )
})

withFixture('v4/basic', (c) => {
  let completion = buildCompletion(c)

  async function expectCompletions({ expect, lang, text, position, settings }) {
    let result = await completion({ lang, text, position, settings })
    let textEdit = expect.objectContaining({ range: { start: position, end: position } })

    expect(result.items.length).toBe(12492)
    expect(result.items.filter((item) => item.label.endsWith(':')).length).toBe(270)
    expect(result).toEqual({
      isIncomplete: false,
      items: expect.arrayContaining([
        expect.objectContaining({ label: 'hover:', textEdit }),
        expect.objectContaining({ label: 'uppercase', textEdit }),
      ]),
    })
  }

  test.concurrent('HTML', async ({ expect }) => {
    await expectCompletions({
      expect,
      text: '<div class=""></div>',
      position: { line: 0, character: 12 },
    })
  })

  test.concurrent('JSX', async ({ expect }) => {
    await expectCompletions({
      expect,
      lang: 'javascriptreact',
      text: "<div className={''}></div>",
      position: {
        line: 0,
        character: 17,
      },
    })
  })

  test.concurrent('JSX concatination', async ({ expect }) => {
    await expectCompletions({
      expect,
      lang: 'javascriptreact',
      text: "<div className={'' + ''}></div>",
      position: {
        line: 0,
        character: 22,
      },
    })
  })

  test.concurrent('JSX outside strings', async ({ expect }) => {
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

  test.concurrent('classRegex simple', async ({ expect }) => {
    await expectCompletions({
      expect,
      text: 'test ',
      position: {
        line: 0,
        character: 5,
      },
      settings: { tailwindCSS: { experimental: { classRegex: ['test (\\S*)'] } } },
    })
  })

  test.concurrent('classRegex simple (no matches)', async ({ expect }) => {
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

  test.concurrent('classRegex nested', async ({ expect }) => {
    await expectCompletions({
      expect,
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

  test.concurrent('classRegex nested (no matches, container)', async ({ expect }) => {
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

  test.concurrent('classRegex nested (no matches, class)', async ({ expect }) => {
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

  test('classRegex matching empty string', async ({ expect }) => {
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

  test.concurrent('Theme variable completions', async ({ expect }) => {
    let result = await completion({
      lang: 'css',
      text: '@theme { -- }',
      position: { line: 0, character: 11 },
    })

    expect(result.items.length).toBe(23)
    expect(result.items.filter((item) => item.label.startsWith('--')).length).toBe(23)
  })

  test.concurrent('@slot is suggeted inside @variant', async ({ expect }) => {
    let result = await completion({
      lang: 'css',
      text: '@',
      position: { line: 0, character: 1 },
    })

    // Make sure `@slot` is NOT suggested by default
    expect(result.items.length).toBe(10)
    expect(result.items).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 14, label: '@slot', sortText: '-0000000' }),
      ]),
    )

    result = await completion({
      lang: 'css',
      text: '@variant foo {\n@',
      position: { line: 1, character: 1 },
    })

    // Make sure `@slot` is suggested
    expect(result.items.length).toBe(11)
    expect(result.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 14, label: '@slot', sortText: '-0000000' }),
      ]),
    )
  })

  test.concurrent('resolve', async ({ expect }) => {
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

withFixture('v4/basic', (c) => {
  let completion = buildCompletion(c)

  test('Completions have customizable pixel equivalents (1rem == 10px)', async ({ expect }) => {
    await c.updateSettings({
      tailwindCSS: {
        rootFontSize: 10,
      },
    })

    let result = await completion({
      lang: 'html',
      text: '<div class=""></div>',
      position: { line: 0, character: 12 },
    })

    let item = result.items.find((item) => item.label === 'text-sm')

    let resolved = await c.sendRequest('completionItem/resolve', item)

    expect(resolved).toEqual({
      ...item,
      detail:
        'font-size: var(--font-size-sm, 0.875rem /* 8.75px */); line-height: var(--tw-leading, var(--font-size-sm--line-height, 1.25rem /* 12.5px */));',
      documentation: {
        kind: 'markdown',
        value:
          '```css\n.text-sm {\n  font-size: var(--font-size-sm, 0.875rem /* 8.75px */);\n  line-height: var(--tw-leading, var(--font-size-sm--line-height, 1.25rem /* 12.5px */));\n}\n```',
      },
    })
  })
})

withFixture('v4/basic', (c) => {
  let completion = buildCompletion(c)

  test('Completions have color equivalents presented as hex', async ({ expect }) => {
    let result = await completion({
      lang: 'html',
      text: '<div class=""></div>',
      position: { line: 0, character: 12 },
    })

    let item = result.items.find((item) => item.label === 'bg-red-500')

    let resolved = await c.sendRequest('completionItem/resolve', item)

    expect(resolved).toEqual({
      ...item,
      detail: 'background-color: var(--color-red-500, oklch(0.637 0.237 25.331));',
      documentation: '#fb2c36',
    })
  })
})

withFixture('v4/workspaces', (c) => {
  let completion = buildCompletion(c)

  test('@import resolution supports exports.style', async ({ expect }) => {
    let result = await completion({
      dir: 'packages/web',
      lang: 'html',
      text: '<div class=""></div>',
      position: { line: 0, character: 12 },
    })

    let items = [
      result.items.find((item) => item.label === 'bg-beet'),
      result.items.find((item) => item.label === 'bg-orangepeel'),
      result.items.find((item) => item.label === 'bg-style-main'),
    ]

    let resolved = await Promise.all(
      items.map((item) => c.sendRequest('completionItem/resolve', item)),
    )

    expect(resolved[0]).toEqual({
      ...items[0],
      detail: 'background-color: var(--color-beet, #8e3b46);',
      documentation: '#8e3b46',
    })

    expect(resolved[1]).toEqual({
      ...items[1],
      detail: 'background-color: var(--color-orangepeel, #ff9f00);',
      documentation: '#ff9f00',
    })

    expect(resolved[2]).toEqual({
      ...items[2],
      detail: 'background-color: var(--color-style-main, #8e3b46);',
      documentation: '#8e3b46',
    })
  })
})
