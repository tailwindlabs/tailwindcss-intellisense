import { expect } from 'vitest'
import { css, defineTest } from '../../src/testing'
import { createClient } from '../utils/client'
import dedent from 'dedent'

let ignored = css`
  @import 'tailwindcss';
  @theme {
    --color-primary: #c0ffee;
  }
`

let found = css`
  @import 'tailwindcss';
  @theme {
    --color-primary: rebeccapurple;
  }
`

defineTest({
  name: 'various build folders and caches are ignored by default',
  fs: {
    // All of these should be ignored
    'aaa/.git/app.css': ignored,
    'aaa/.hg/app.css': ignored,
    'aaa/.svn/app.css': ignored,
    'aaa/node_modules/app.css': ignored,
    'aaa/.yarn/app.css': ignored,
    'aaa/.venv/app.css': ignored,
    'aaa/venv/app.css': ignored,
    'aaa/.next/app.css': ignored,
    'aaa/.parcel-cache/app.css': ignored,
    'aaa/.svelte-kit/app.css': ignored,
    'aaa/.turbo/app.css': ignored,
    'aaa/__pycache__/app.css': ignored,

    // But this one should not be
    'zzz/app.css': found,
  },

  prepare: async ({ root }) => ({ client: await createClient({ root }) }),
  handle: async ({ client }) => {
    let doc = await client.open({
      lang: 'html',
      text: '<div class="bg-primary">',
    })

    // <div class="bg-primary">
    //             ^
    let hover = await doc.hover({ line: 0, character: 13 })
    expect(hover).toEqual({
      contents: {
        language: 'css',
        value: dedent`
          .bg-primary {
            background-color: var(--color-primary) /* rebeccapurple = #663399 */;
          }
        `,
      },
      range: {
        start: { line: 0, character: 12 },
        end: { line: 0, character: 22 },
      },
    })
  },
})

defineTest({
  name: 'ignores can be overridden',
  fs: {
    'aaa/app.css': ignored,
    'bbb/.git/app.css': found,
  },

  prepare: async ({ root }) => ({
    client: await createClient({
      root,
      settings: {
        tailwindCSS: {
          files: {
            exclude: ['**/aaa/**'],
          },
        },
      },
    }),
  }),
  handle: async ({ client }) => {
    let doc = await client.open({
      lang: 'html',
      text: '<div class="bg-primary">',
    })

    // <div class="bg-primary">
    //             ^
    let hover = await doc.hover({ line: 0, character: 13 })
    expect(hover).toEqual({
      contents: {
        language: 'css',
        value: dedent`
          .bg-primary {
            background-color: var(--color-primary) /* rebeccapurple = #663399 */;
          }
        `,
      },
      range: {
        start: { line: 0, character: 12 },
        end: { line: 0, character: 22 },
      },
    })
  },
})
