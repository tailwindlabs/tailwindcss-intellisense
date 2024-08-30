import { test } from 'vitest'
import { withFixture } from '../common'

withFixture('basic', (c) => {
  async function testHover(
    name,
    { text, lang, position, exact = false, expected, expectedRange, settings },
  ) {
    test.concurrent(name, async ({ expect }) => {
      let textDocument = await c.openDocument({ text, lang, settings })
      let res = await c.sendRequest('textDocument/hover', {
        textDocument,
        position,
      })

      if (!exact && expected) {
        expected = {
          contents: {
            language: 'css',
            value: expected,
          },
          range: expectedRange,
        }
      }

      expect(res).toEqual(expected)
    })
  }

  testHover('disabled', {
    text: '<div class="bg-red-500">',
    settings: {
      tailwindCSS: { hovers: false },
    },
    expected: null,
  })

  testHover('hover', {
    text: '<div class="bg-red-500">',
    position: { line: 0, character: 13 },
    expected:
      '.bg-red-500 {\n' +
      '  --tw-bg-opacity: 1;\n' +
      '  background-color: rgb(239 68 68 / var(--tw-bg-opacity)) /* #ef4444 */;\n' +
      '}',
    expectedRange: {
      start: { line: 0, character: 12 },
      end: { line: 0, character: 22 },
    },
  })

  testHover('arbitrary value', {
    text: '<div class="p-[3px]">',
    position: { line: 0, character: 13 },
    expected: '.p-\\[3px\\] {\n' + '  padding: 3px;\n' + '}',
    expectedRange: {
      start: { line: 0, character: 12 },
      end: { line: 0, character: 19 },
    },
  })

  testHover('arbitrary value with theme function', {
    text: '<div class="p-[theme(spacing.4)]">',
    position: { line: 0, character: 13 },
    expected: '.p-\\[theme\\(spacing\\.4\\)\\] {\n' + '  padding: 1rem /* 16px */;\n' + '}',
    expectedRange: {
      start: { line: 0, character: 12 },
      end: { line: 0, character: 32 },
    },
  })

  testHover('arbitrary property', {
    text: '<div class="[text-wrap:balance]">',
    position: { line: 0, character: 13 },
    expected: '.\\[text-wrap\\:balance\\] {\n' + '  text-wrap: balance;\n' + '}',
    expectedRange: {
      start: { line: 0, character: 12 },
      end: { line: 0, character: 31 },
    },
  })

  testHover('vue <style lang=sass>', {
    lang: 'vue',
    text: `<style lang="sass">
.foo
  @apply underline
</style>`,
    position: { line: 2, character: 13 },
    expected: '.underline {\n' + '  text-decoration-line: underline;\n' + '}',
    expectedRange: {
      start: { line: 2, character: 9 },
      end: { line: 2, character: 18 },
    },
  })

  testHover('showPixelEquivalents works with theme()', {
    lang: 'tailwindcss',
    text: `.foo { font-size: theme(fontSize.xl) }`,
    position: { line: 0, character: 32 },

    exact: true,
    expected: {
      contents: {
        kind: 'markdown',
        value: ['```plaintext', '1.25rem /* 20px */', '```'].join('\n'),
      },
      range: {
        start: { line: 0, character: 24 },
        end: { line: 0, character: 35 },
      },
    },
  })

  testHover('color equivalents supports in-gamut oklch/oklab', {
    lang: 'html',
    text: '<div class="text-[oklch(44.05%_0.16_303)]">',
    position: { line: 0, character: 32 },

    exact: true,
    expected: {
      contents: {
        language: 'css',
        value: [
          '.text-\\[oklch\\(44\\.05\\%_0\\.16_303\\)\\] {',
          '  color: oklch(44.05% 0.16 303) /* #663399 */;',
          '}',
        ].join('\n'),
      },
      range: {
        start: { line: 0, character: 12 },
        end: { line: 0, character: 41 },
      },
    },
  })

  testHover('color equivalents ignores wide-gamut oklch/oklab', {
    lang: 'html',
    text: '<div class="text-[oklch(60%_0.26_20)]">',
    position: { line: 0, character: 32 },

    exact: true,
    expected: {
      contents: {
        language: 'css',
        value: [
          '.text-\\[oklch\\(60\\%_0\\.26_20\\)\\] {',
          '  color: oklch(60% 0.26 20);',
          '}',
        ].join('\n'),
      },
      range: {
        start: { line: 0, character: 12 },
        end: { line: 0, character: 37 },
      },
    },
  })
})

withFixture('v4/basic', (c) => {
  async function testHover(name, { text, lang, position, expected, expectedRange, settings }) {
    test.concurrent(name, async ({ expect }) => {
      let textDocument = await c.openDocument({ text, lang, settings })
      let res = await c.sendRequest('textDocument/hover', {
        textDocument,
        position,
      })

      expect(res).toEqual(
        expected
          ? {
              contents: {
                language: 'css',
                value: expected,
              },
              range: expectedRange,
            }
          : expected,
      )
    })
  }

  testHover('disabled', {
    text: '<div class="bg-red-500">',
    settings: {
      tailwindCSS: { hovers: false },
    },
    expected: null,
  })

  testHover('hover', {
    text: '<div class="bg-red-500">',
    position: { line: 0, character: 13 },
    expected: '.bg-red-500 {\n  background-color: var(--color-red-500, #ef4444);\n}',
    expectedRange: {
      start: { line: 0, character: 12 },
      end: { line: 0, character: 22 },
    },
  })

  testHover('arbitrary value', {
    text: '<div class="p-[3px]">',
    position: { line: 0, character: 13 },
    expected: '.p-\\[3px\\] {\n  padding: 3px;\n}',
    expectedRange: {
      start: { line: 0, character: 12 },
      end: { line: 0, character: 19 },
    },
  })

  test.todo('arbitrary value with theme function')
  // testHover('arbitrary value with theme function', {
  //   text: '<div class="p-[theme(spacing.4)]">',
  //   position: { line: 0, character: 13 },
  //   expected: '.p-\\[theme\\(spacing\\.4\\)\\] {\n' + '  padding: 1rem /* 16px */;\n' + '}',
  //   expectedRange: {
  //     start: { line: 0, character: 12 },
  //     end: { line: 0, character: 32 },
  //   },
  // })

  testHover('arbitrary property', {
    text: '<div class="[text-wrap:balance]">',
    position: { line: 0, character: 13 },
    expected: '.\\[text-wrap\\:balance\\] {\n  text-wrap: balance;\n}',
    expectedRange: {
      start: { line: 0, character: 12 },
      end: { line: 0, character: 31 },
    },
  })

  testHover('vue <style lang=sass>', {
    lang: 'vue',
    text: `<style lang="sass">
.foo
  @apply underline
</style>`,
    position: { line: 2, character: 13 },
    expected: '.underline {\n' + '  text-decoration-line: underline;\n' + '}',
    expectedRange: {
      start: { line: 2, character: 9 },
      end: { line: 2, character: 18 },
    },
  })
})

withFixture('v4/css-loading-js', (c) => {
  async function testHover(name, { text, lang, position, expected, expectedRange, settings }) {
    test.concurrent(name, async ({ expect }) => {
      let textDocument = await c.openDocument({ text, lang, settings })
      let res = await c.sendRequest('textDocument/hover', {
        textDocument,
        position,
      })

      expect(res).toEqual(
        expected
          ? {
              contents: {
                language: 'css',
                value: expected,
              },
              range: expectedRange,
            }
          : expected,
      )
    })
  }

  testHover('Plugins: ESM', {
    text: '<div class="bg-esm-from-plugin">',
    position: { line: 0, character: 13 },
    expected: '.bg-esm-from-plugin {\n  background-color: black;\n}',
    expectedRange: {
      start: { line: 0, character: 12 },
      end: { line: 0, character: 30 },
    },
  })

  testHover('Plugins: CJS', {
    text: '<div class="bg-cjs-from-plugin">',
    position: { line: 0, character: 13 },
    expected: '.bg-cjs-from-plugin {\n  background-color: black;\n}',
    expectedRange: {
      start: { line: 0, character: 12 },
      end: { line: 0, character: 30 },
    },
  })

  testHover('Plugins: TypeScript', {
    text: '<div class="bg-ts-from-plugin">',
    position: { line: 0, character: 13 },
    expected: '.bg-ts-from-plugin {\n  background-color: black;\n}',
    expectedRange: {
      start: { line: 0, character: 12 },
      end: { line: 0, character: 29 },
    },
  })

  testHover('Configs: ESM', {
    text: '<div class="bg-esm-from-config">',
    position: { line: 0, character: 13 },
    expected: '.bg-esm-from-config {\n  background-color: black;\n}',
    expectedRange: {
      start: { line: 0, character: 12 },
      end: { line: 0, character: 30 },
    },
  })

  testHover('Configs: CJS', {
    text: '<div class="bg-cjs-from-config">',
    position: { line: 0, character: 13 },
    expected: '.bg-cjs-from-config {\n  background-color: black;\n}',
    expectedRange: {
      start: { line: 0, character: 12 },
      end: { line: 0, character: 30 },
    },
  })

  testHover('Configs: TypeScript', {
    text: '<div class="bg-ts-from-config">',
    position: { line: 0, character: 13 },
    expected: '.bg-ts-from-config {\n  background-color: black;\n}',
    expectedRange: {
      start: { line: 0, character: 12 },
      end: { line: 0, character: 29 },
    },
  })
})
