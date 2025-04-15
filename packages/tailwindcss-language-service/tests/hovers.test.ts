import { test, expect, describe } from 'vitest'
import { createClient } from './utils/client'
import { css, html, range } from './utils/utils'

describe('v4', async () => {
  let client = await createClient({
    config: {
      kind: 'css',
      content: css`
        @theme {
          --spacing-4: 1rem;
          --breakpoint-xl: 80rem;
          --color-black: #000;
        }
      `,
    },
  })

  test('disabled', async () => {
    let doc = await client.open({
      lang: 'html',
      text: '<div class="bg-black">',
      settings: {
        tailwindCSS: { hovers: false },
      },
    })

    expect(await doc.hover({ line: 0, character: 13 })).toEqual(null)
  })

  test('named', async () => {
    let doc = await client.open({
      lang: 'html',
      text: '<div class="bg-black">',
    })

    expect(await doc.hover({ line: 0, character: 13 })).toEqual({
      range: range(0, 12, 0, 20),
      contents: {
        language: 'css',
        value: '.bg-black {\n  background-color: var(--color-black) /* #000 = #000000 */;\n}',
      },
    })
  })

  test('arbitrary value', async () => {
    let doc = await client.open({
      lang: 'html',
      text: '<div class="p-[3px]">',
    })

    expect(await doc.hover({ line: 0, character: 13 })).toEqual({
      range: range(0, 12, 0, 19),
      contents: {
        language: 'css',
        value: '.p-\\[3px\\] {\n  padding: 3px;\n}',
      },
    })
  })

  test('arbitrary value + theme fn (modern)', async () => {
    let doc = await client.open({
      lang: 'html',
      text: '<div class="p-[theme(--spacing-4)]">',
    })

    expect(await doc.hover({ line: 0, character: 13 })).toEqual({
      range: range(0, 12, 0, 34),
      contents: {
        language: 'css',
        value: '.p-\\[theme\\(--spacing-4\\)\\] {\n' + '  padding: 1rem /* 16px */;\n' + '}',
      },
    })
  })

  test('arbitrary value + theme fn (legacy)', async () => {
    let doc = await client.open({
      lang: 'html',
      text: '<div class="p-[theme(spacing.4)]">',
    })

    expect(await doc.hover({ line: 0, character: 13 })).toEqual({
      range: range(0, 12, 0, 32),
      contents: {
        language: 'css',
        value: '.p-\\[theme\\(spacing\\.4\\)\\] {\n' + '  padding: 1rem /* 16px */;\n' + '}',
      },
    })
  })

  test('arbitrary property', async () => {
    let doc = await client.open({
      lang: 'html',
      text: '<div class="[text-wrap:balance]">',
    })

    expect(await doc.hover({ line: 0, character: 13 })).toEqual({
      range: range(0, 12, 0, 31),
      contents: {
        language: 'css',
        value: '.\\[text-wrap\\:balance\\] {\n  text-wrap: balance;\n}',
      },
    })
  })

  test('named + apply + vue <style lang=sass>', async () => {
    let doc = await client.open({
      lang: 'vue',
      text: html`
        <style lang="sass">
          .foo
            @apply underline
        </style>
      `,
    })

    expect(await doc.hover({ line: 2, character: 13 })).toEqual({
      range: range(2, 11, 2, 20),
      contents: {
        language: 'css',
        value: '.underline {\n' + '  text-decoration-line: underline;\n' + '}',
      },
    })
  })

  test('@source glob expansion', async () => {
    let doc = await client.open({
      lang: 'css',
      text: css`
        @source "../{app,components}/**/*.jsx";
      `,
    })

    expect(await doc.hover({ line: 0, character: 23 })).toEqual({
      range: range(0, 8, 0, 38),
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
    })
  })

  test('@source not glob expansion', async () => {
    let doc = await client.open({
      lang: 'css',
      text: css`
        @source not "../{app,components}/**/*.jsx";
      `,
    })

    expect(await doc.hover({ line: 0, character: 23 })).toEqual({
      range: range(0, 12, 0, 42),
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
    })
  })

  test('@source inline(…) glob expansion', async () => {
    let doc = await client.open({
      lang: 'css',
      text: css`
        @source inline("{,hover:,active:}m-{1,2,3}");
      `,
    })

    expect(await doc.hover({ line: 0, character: 23 })).toEqual({
      range: range(0, 15, 0, 43),
      contents: {
        kind: 'markdown',
        value: [
          '**Expansion**',
          '```plaintext',
          '- m-1',
          '- m-2',
          '- m-3',
          '- hover:m-1',
          '- hover:m-2',
          '- hover:m-3',
          '- active:m-1',
          '- active:m-2',
          '- active:m-3',
          '```',
        ].join('\n'),
      },
    })
  })

  test('@source not inline(…) glob expansion', async () => {
    let doc = await client.open({
      lang: 'css',
      text: css`
        @source not inline("{,hover:,active:}m-{1,2,3}");
      `,
    })

    expect(await doc.hover({ line: 0, character: 23 })).toEqual({
      range: range(0, 19, 0, 47),
      contents: {
        kind: 'markdown',
        value: [
          '**Expansion**',
          '```plaintext',
          '- m-1',
          '- m-2',
          '- m-3',
          '- hover:m-1',
          '- hover:m-2',
          '- hover:m-3',
          '- active:m-1',
          '- active:m-2',
          '- active:m-3',
          '```',
        ].join('\n'),
      },
    })
  })

  test('--theme() inside media query', async () => {
    let doc = await client.open({
      lang: 'css',
      text: css`
        @media (width>=--theme(--breakpoint-xl)) {
          .foo {
            color: red;
          }
        }
      `,
    })

    expect(await doc.hover({ line: 0, character: 23 })).toEqual({
      range: range(0, 23, 0, 38),
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
    })
  })

  test('var(…) and theme(…) show theme values', async () => {
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
      range: range(1, 15, 1, 28),
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
    })

    expect(hoverVar).toEqual({
      range: range(4, 13, 4, 26),
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
    })
  })
})
