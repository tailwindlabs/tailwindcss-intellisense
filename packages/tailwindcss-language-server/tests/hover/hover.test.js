import { test } from 'vitest'
import { withFixture } from '../common'

withFixture('basic', (c) => {
  async function testHover(name, { text, lang, position, exact = false, expected, expectedRange, settings }) {
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
      '  background-color: rgb(239 68 68 / var(--tw-bg-opacity))/* #ef4444 */;\n' +
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
    expected: '.p-\\[theme\\(spacing\\.4\\)\\] {\n' + '  padding: 1rem/* 16px */;\n' + '}',
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
        value: [
          '```plaintext',
          '1.25rem/* 20px */',
          '```',
        ].join('\n'),
      },
      range: {
        start: { line: 0, character: 24 },
        end: { line: 0, character: 35 },
      }
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
    expected: '.bg-red-500 {\n  background-color: #ef4444;\n}',
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
  //   expected: '.p-\\[theme\\(spacing\\.4\\)\\] {\n' + '  padding: 1rem/* 16px */;\n' + '}',
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
