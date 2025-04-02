import { expect, test } from 'vitest'
import { withFixture } from '../common'
import { css, defineTest } from '../../src/testing'
import { createClient } from '../utils/client'

withFixture('basic', (c) => {
  async function testHover(
    name,
    { text, lang, position, exact = false, expected, expectedRange, settings },
  ) {
    test(name, async ({ expect }) => {
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
    position: { line: 0, character: 13 },
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
      '  background-color: rgb(239 68 68 / var(--tw-bg-opacity, 1)) /* #ef4444 */;\n' +
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

  testHover('theme() works inside @media queries', {
    lang: 'tailwindcss',
    text: `@media (width>=theme(screens.xl)) { .foo { color: red; } }`,
    position: { line: 0, character: 21 },

    exact: true,
    expected: {
      contents: {
        kind: 'markdown',
        value: ['```plaintext', '1280px', '```'].join('\n'),
      },
      range: {
        start: { line: 0, character: 21 },
        end: { line: 0, character: 31 },
      },
    },
  })
})

withFixture('v4/basic', (c) => {
  async function testHover(
    name,
    { text, exact = false, lang, position, expected, expectedRange, settings },
  ) {
    test(name, async ({ expect }) => {
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
    position: { line: 0, character: 13 },
    settings: {
      tailwindCSS: { hovers: false },
    },
    expected: null,
  })

  testHover('hover', {
    text: '<div class="bg-red-500">',
    position: { line: 0, character: 13 },
    expected:
      '.bg-red-500 {\n  background-color: var(--color-red-500) /* oklch(63.7% 0.237 25.331) = #fb2c36 */;\n}',
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

  testHover('css @source glob expansion', {
    exact: true,
    lang: 'css',
    text: `@source "../{app,components}/**/*.jsx"`,
    position: { line: 0, character: 23 },
    expected: {
      contents: {
        kind: 'markdown',
        value: [
          '**Expansion**',
          '```plaintext',
          '- ../app/**/*.jsx',
          '- ../components/**/*.jsx',
          '```',
        ].join('\n'),
      },
      range: {
        start: { line: 0, character: 8 },
        end: { line: 0, character: 38 },
      },
    },
    expectedRange: {
      start: { line: 2, character: 9 },
      end: { line: 2, character: 18 },
    },
  })

  testHover('css @source not glob expansion', {
    exact: true,
    lang: 'css',
    text: `@source not "../{app,components}/**/*.jsx"`,
    position: { line: 0, character: 23 },
    expected: {
      contents: {
        kind: 'markdown',
        value: [
          '**Expansion**',
          '```plaintext',
          '- ../app/**/*.jsx',
          '- ../components/**/*.jsx',
          '```',
        ].join('\n'),
      },
      range: {
        start: { line: 0, character: 12 },
        end: { line: 0, character: 42 },
      },
    },
    expectedRange: {
      start: { line: 2, character: 9 },
      end: { line: 2, character: 18 },
    },
  })

  testHover('css @source inline glob expansion', {
    exact: true,
    lang: 'css',
    text: `@source inline("{hover:,active:,}m-{1,2,3}")`,
    position: { line: 0, character: 23 },
    expected: {
      contents: {
        kind: 'markdown',
        value: [
          '**Expansion**',
          '```plaintext',
          '- hover:m-1',
          '- hover:m-2',
          '- hover:m-3',
          '- active:m-1',
          '- active:m-2',
          '- active:m-3',
          '- m-1',
          '- m-2',
          '- m-3',
          '```',
        ].join('\n'),
      },
      range: {
        start: { line: 0, character: 15 },
        end: { line: 0, character: 43 },
      },
    },
    expectedRange: {
      start: { line: 2, character: 9 },
      end: { line: 2, character: 15 },
    },
  })

  testHover('css @source not inline glob expansion', {
    exact: true,
    lang: 'css',
    text: `@source not inline("{hover:,active:,}m-{1,2,3}")`,
    position: { line: 0, character: 23 },
    expected: {
      contents: {
        kind: 'markdown',
        value: [
          '**Expansion**',
          '```plaintext',
          '- hover:m-1',
          '- hover:m-2',
          '- hover:m-3',
          '- active:m-1',
          '- active:m-2',
          '- active:m-3',
          '- m-1',
          '- m-2',
          '- m-3',
          '```',
        ].join('\n'),
      },
      range: {
        start: { line: 0, character: 19 },
        end: { line: 0, character: 47 },
      },
    },
    expectedRange: {
      start: { line: 2, character: 9 },
      end: { line: 2, character: 18 },
    },
  })

  testHover('--theme() works inside @media queries', {
    lang: 'tailwindcss',
    text: `@media (width>=--theme(--breakpoint-xl)) { .foo { color: red; } }`,
    position: { line: 0, character: 23 },

    exact: true,
    expected: {
      contents: {
        kind: 'markdown',
        value: [
          //
          '```css',
          '@theme {',
          '  --breakpoint-xl: 80rem /* 1280px */;',
          '}',
          '```',
        ].join('\n'),
      },
      range: {
        start: { line: 0, character: 23 },
        end: { line: 0, character: 38 },
      },
    },
  })
})

withFixture('v4/css-loading-js', (c) => {
  async function testHover(name, { text, lang, position, expected, expectedRange, settings }) {
    test(name, async ({ expect }) => {
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

withFixture('v4/path-mappings', (c) => {
  async function testHover(name, { text, lang, position, expected, expectedRange, settings }) {
    test(name, async ({ expect }) => {
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

  testHover('Mapping: CSS Imports', {
    text: '<div class="bg-map-a-css">',
    position: { line: 0, character: 13 },
    expected:
      '.bg-map-a-css {\n  background-color: var(--color-map-a-css) /* black = #000000 */;\n}',
    expectedRange: {
      start: { line: 0, character: 12 },
      end: { line: 0, character: 24 },
    },
  })

  testHover('Mapping: Configs', {
    text: '<div class="bg-map-a-config">',
    position: { line: 0, character: 13 },
    expected: '.bg-map-a-config {\n  background-color: black;\n}',
    expectedRange: {
      start: { line: 0, character: 12 },
      end: { line: 0, character: 27 },
    },
  })

  testHover('Mapping: Plugins', {
    text: '<div class="bg-map-a-plugin">',
    position: { line: 0, character: 13 },
    expected: '.bg-map-a-plugin {\n  background-color: black;\n}',
    expectedRange: {
      start: { line: 0, character: 12 },
      end: { line: 0, character: 27 },
    },
  })
})

defineTest({
  name: 'Can hover showing theme values used in var(…) and theme(…) functions',
  fs: {
    'app.css': css`
      @import 'tailwindcss';
    `,
  },

  prepare: async ({ root }) => ({ client: await createClient({ root }) }),

  handle: async ({ client }) => {
    let doc = await client.open({
      lang: 'css',
      text: css`
        .foo {
          color: theme(--color-black);
        }
        .bar {
          color: var(--color-black);
        }
      `,
    })

    //   color: theme(--color-black);
    //                  ^
    let hoverTheme = await doc.hover({ line: 1, character: 18 })

    //   color: var(--color-black);
    //                ^
    let hoverVar = await doc.hover({ line: 4, character: 16 })

    expect(hoverTheme).toEqual({
      contents: {
        kind: 'markdown',
        value: [
          //
          '```css',
          '@theme {',
          '  --color-black: #000;',
          '}',
          '```',
        ].join('\n'),
      },
      range: {
        start: { line: 1, character: 15 },
        end: { line: 1, character: 28 },
      },
    })

    expect(hoverVar).toEqual({
      contents: {
        kind: 'markdown',
        value: [
          //
          '```css',
          '@theme {',
          '  --color-black: #000;',
          '}',
          '```',
        ].join('\n'),
      },
      range: {
        start: { line: 4, character: 13 },
        end: { line: 4, character: 26 },
      },
    })
  },
})
