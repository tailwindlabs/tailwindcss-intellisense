import { test, expect } from 'vitest'
import { withFixture } from '../common'
import { css, defineTest, html, js } from '../../src/testing'
import { createClient } from '../utils/client'
import { CompletionItemKind } from 'vscode-languageserver'

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
      detail: '--tw-bg-opacity: 1; background-color: rgb(239 68 68 / var(--tw-bg-opacity, 1));',
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

    expect(result.items.length).not.toBe(0)
    expect(result.items.filter((item) => item.label.endsWith(':')).length).not.toBe(0)
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

  test.concurrent('@slot is suggeted inside @custom-variant', async ({ expect }) => {
    let result = await completion({
      lang: 'css',
      text: '@',
      position: { line: 0, character: 1 },
    })

    // Make sure `@slot` is NOT suggested by default
    expect(result.items.length).toBe(8)
    expect(result.items).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 14, label: '@slot', sortText: '-0000000' }),
      ]),
    )

    result = await completion({
      lang: 'css',
      text: '@custom-variant foo {\n@',
      position: { line: 1, character: 1 },
    })

    // Make sure `@slot` is suggested
    expect(result.items.length).toBe(4)
    expect(result.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 14, label: '@slot', sortText: '-0000000' }),
      ]),
    )
  })

  test.concurrent('@theme suggests options', async ({ expect }) => {
    let result = await completion({
      lang: 'css',
      text: '@theme ',
      position: { line: 0, character: 7 },
    })

    expect(result.items.length).toBe(4)
    expect(result.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: 'reference' }),
        expect.objectContaining({ label: 'inline' }),
        expect.objectContaining({ label: 'default' }),
        expect.objectContaining({ label: 'static' }),
      ]),
    )
  })

  test.concurrent('@import "…" theme(…) suggests options', async ({ expect }) => {
    let result = await completion({
      lang: 'css',
      text: '@import "tailwindcss/theme" theme()',
      position: { line: 0, character: 34 },
    })

    expect(result.items.length).toBe(4)
    expect(result.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: 'reference' }),
        expect.objectContaining({ label: 'inline' }),
        expect.objectContaining({ label: 'default' }),
        expect.objectContaining({ label: 'static' }),
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
      detail: [
        //
        'font-size: 0.875rem /* 8.75px */;',
        'line-height: calc(1.25 / 0.875);',
      ].join(' '),
      documentation: {
        kind: 'markdown',
        value: [
          '```css',
          '.text-sm {',
          '  font-size: var(--text-sm) /* 0.875rem = 8.75px */;',
          '  line-height: var(--tw-leading, var(--text-sm--line-height) /* calc(1.25 / 0.875) ≈ 1.4286 */);',
          '}',
          '```',
        ].join('\n'),
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
      detail: 'background-color: oklch(63.7% 0.237 25.331);',
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
      detail: 'background-color: #8e3b46;',
      documentation: '#8e3b46',
    })

    expect(resolved[1]).toEqual({
      ...items[1],
      detail: 'background-color: #ff9f00;',
      documentation: '#ff9f00',
    })

    expect(resolved[2]).toEqual({
      ...items[2],
      detail: 'background-color: #8e3b46;',
      documentation: '#8e3b46',
    })
  })
})

defineTest({
  name: 'v4: Completions show after a variant arbitrary value',
  fs: {
    'app.css': css`
      @import 'tailwindcss';
    `,
  },
  prepare: async ({ root }) => ({ client: await createClient({ root }) }),
  handle: async ({ client }) => {
    let document = await client.open({
      lang: 'html',
      text: '<div class="data-[foo]:">',
    })

    // <div class="data-[foo]:">
    //                       ^
    let completion = await document.completions({ line: 0, character: 23 })

    expect(completion?.items.length).not.toBe(0)
  },
})

defineTest({
  name: 'v4: Completions show after an arbitrary variant',
  fs: {
    'app.css': css`
      @import 'tailwindcss';
    `,
  },
  prepare: async ({ root }) => ({ client: await createClient({ root }) }),
  handle: async ({ client }) => {
    let document = await client.open({
      lang: 'html',
      text: '<div class="[&:hover]:">',
    })

    // <div class="[&:hover]:">
    //                      ^
    let completion = await document.completions({ line: 0, character: 22 })

    expect(completion?.items.length).not.toBe(0)
  },
})

defineTest({
  name: 'v4: Completions show after a variant with a bare value',
  fs: {
    'app.css': css`
      @import 'tailwindcss';
    `,
  },
  prepare: async ({ root }) => ({ client: await createClient({ root }) }),
  handle: async ({ client }) => {
    let document = await client.open({
      lang: 'html',
      text: '<div class="supports-not-hover:">',
    })

    // <div class="supports-not-hover:">
    //                               ^
    let completion = await document.completions({ line: 0, character: 31 })

    expect(completion?.items.length).not.toBe(0)
  },
})

defineTest({
  name: 'v4: Completions show after a variant arbitrary value, using prefixes',
  fs: {
    'app.css': css`
      @import 'tailwindcss' prefix(tw);
    `,
  },
  prepare: async ({ root }) => ({ client: await createClient({ root }) }),
  handle: async ({ client }) => {
    let document = await client.open({
      lang: 'html',
      text: '<div class="tw:data-[foo]:">',
    })

    // <div class="tw:data-[foo]:">
    //                          ^
    let completion = await document.completions({ line: 0, character: 26 })

    expect(completion?.items.length).not.toBe(0)
  },
})

defineTest({
  name: 'v4: Variant and utility suggestions show prefix when one has been typed',
  fs: {
    'app.css': css`
      @import 'tailwindcss' prefix(tw);
    `,
  },
  prepare: async ({ root }) => ({ client: await createClient({ root }) }),
  handle: async ({ client }) => {
    let document = await client.open({
      lang: 'html',
      text: '<div class="">',
    })

    // <div class="">
    //            ^
    let completion = await document.completions({ line: 0, character: 12 })

    expect(completion?.items.length).not.toBe(0)

    // Verify that variants and utilities are all prefixed
    let prefixed = completion.items.filter((item) => !item.label.startsWith('tw:'))
    expect(prefixed).toHaveLength(0)
  },
})

defineTest({
  name: 'v4: Variant and utility suggestions hide prefix when it has been typed',
  fs: {
    'app.css': css`
      @import 'tailwindcss' prefix(tw);
    `,
  },
  prepare: async ({ root }) => ({ client: await createClient({ root }) }),
  handle: async ({ client }) => {
    let document = await client.open({
      lang: 'html',
      text: '<div class="tw:">',
    })

    // <div class="tw:">
    //               ^
    let completion = await document.completions({ line: 0, character: 15 })

    expect(completion?.items.length).not.toBe(0)

    // Verify that no variants and utilities have prefixes
    let prefixed = completion.items.filter((item) => item.label.startsWith('tw:'))
    expect(prefixed).toHaveLength(0)
  },
})

defineTest({
  name: 'v4: Completions show inside class functions in JS/TS files',
  fs: {
    'app.css': css`
      @import 'tailwindcss';
    `,
  },
  prepare: async ({ root }) => ({ client: await createClient({ root }) }),
  handle: async ({ client }) => {
    let document = await client.open({
      settings: {
        tailwindCSS: {
          classFunctions: ['clsx'],
        },
      },
      lang: 'javascript',
      text: js`
        let classes = clsx('');
      `,
    })

    // let classes = clsx('');
    //                    ^
    let completion = await document.completions({ line: 0, character: 20 })

    expect(completion?.items.length).not.toBe(0)
  },
})

defineTest({
  name: 'v4: Completions show inside class functions in JS/TS contexts',
  fs: {
    'app.css': css`
      @import 'tailwindcss';
    `,
  },
  prepare: async ({ root }) => ({ client: await createClient({ root }) }),
  handle: async ({ client }) => {
    let document = await client.open({
      settings: {
        tailwindCSS: {
          classFunctions: ['clsx'],
        },
      },
      lang: 'html',
      text: html`
        <script>
          let classes = clsx('')
        </script>
      `,
    })

    //   let classes = clsx('')
    //                      ^
    let completion = await document.completions({ line: 1, character: 22 })

    expect(completion?.items.length).not.toBe(0)
  },
})

defineTest({
  name: 'v4: Theme key completions show in var(…)',
  fs: {
    'app.css': css`
      @import 'tailwindcss';

      @theme {
        --color-custom: #000;
      }
    `,
  },
  prepare: async ({ root }) => ({ client: await createClient({ root }) }),
  handle: async ({ client }) => {
    let document = await client.open({
      settings: {
        tailwindCSS: {
          classFunctions: ['clsx'],
        },
      },
      lang: 'css',
      text: css`
        .foo {
          color: var();
        }
      `,
    })

    //   color: var();
    //             ^
    let completion = await document.completions({ line: 1, character: 13 })

    expect(completion).toEqual({
      isIncomplete: false,
      items: expect.arrayContaining([
        // From the default theme
        expect.objectContaining({ label: '--font-sans' }),

        // From the `@theme` block in the CSS file
        expect.objectContaining({
          label: '--color-custom',

          // And it's shown as a color
          kind: CompletionItemKind.Color,
          documentation: '#000000',
        }),
      ]),
    })
  },
})

defineTest({
  name: 'v4: class function completions mixed with class attribute completions work',
  fs: {
    'app.css': css`
      @import 'tailwindcss';
    `,
  },
  prepare: async ({ root }) => ({ client: await createClient({ root }) }),
  handle: async ({ client }) => {
    let document = await client.open({
      settings: {
        tailwindCSS: {
          classAttributes: ['className'],
          classFunctions: ['cn', 'cva'],
        },
      },
      lang: 'javascriptreact',
      text: js`
        let x = cva("")

        export function Button() {
          return <Test className={cn("")} />
        }

        export function Button2() {
          return <Test className={cn("")} />
        }

        let y = cva("")
      `,
    })

    // let x = cva("");
    //             ^
    let completionA = await document.completions({ line: 0, character: 13 })

    expect(completionA?.items.length).not.toBe(0)

    //   return <Test className={cn("")} />;
    //                              ^
    let completionB = await document.completions({ line: 3, character: 30 })

    expect(completionB?.items.length).not.toBe(0)

    //   return <Test className={cn("")} />;
    //                              ^
    let completionC = await document.completions({ line: 7, character: 30 })

    expect(completionC?.items.length).not.toBe(0)

    // let y = cva("");
    //             ^
    let completionD = await document.completions({ line: 10, character: 13 })

    expect(completionD?.items.length).not.toBe(0)
  },
})
