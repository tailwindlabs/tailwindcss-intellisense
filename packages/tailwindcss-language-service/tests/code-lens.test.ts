import { describe, expect, test } from 'vitest'
import { createClient } from './utils/client'
import { css, range } from './utils/utils'

describe('v4', async () => {
  let client = await createClient({
    config: {
      kind: 'css',
      content: css`
        @theme {
          --color-black: #000;
          --color-primary: #f00;
          --color-light-dark: light-dark(#ff0000, #0000ff);
        }
      `,
    },
  })

  test('code lenses are displayed for @source inline(…)', async () => {
    let doc = await client.open({
      lang: 'css',
      text: css`
        @import 'tailwindcss';
        @source inline("{,{hover,focus}:}{flex,underline,bg-red-{50,{100..900.100},950}}");
      `,
    })

    expect(await doc.codeLenses()).toEqual([
      {
        range: range(1, 15, 1, 81),
        command: {
          command: '',
          title: 'Generates 15 classes',
        },
      },
    ])
  })

  test('the user is warned when @source inline(…) generates a lerge amount of CSS', async () => {
    let doc = await client.open({
      lang: 'css',
      text: css`
        @import 'tailwindcss';
        @source inline("{,dark:}{,{sm,md,lg,xl,2xl}:}{,{hover,focus,active}:}{flex,underline,bg-red-{50,{100..900.100},950}{,/{0..100}}}");
      `,
    })

    expect(await doc.codeLenses()).toEqual([
      {
        range: range(1, 15, 1, 129),
        command: {
          command: '',
          title: 'Generates 14,784 classes',
        },
      },
      {
        range: range(1, 15, 1, 129),
        command: {
          command: '',
          title: 'At least 3MB of CSS',
        },
      },
      {
        range: range(1, 15, 1, 129),
        command: {
          command: '',
          title: 'This may slow down your bundler/browser',
        },
      },
    ])
  })
})
