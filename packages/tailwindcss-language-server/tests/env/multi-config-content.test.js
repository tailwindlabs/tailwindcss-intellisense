import { expect } from 'vitest'
import { css, defineTest, html, js, json, symlinkTo } from '../../src/testing'
import dedent from 'dedent'
import { createClient } from '../utils/client'

defineTest({
  name: 'multi-config with content config',
  fs: {
    'tailwind.config.one.js': js`
      module.exports = {
        content: ['./one/**/*'],
        theme: {
          extend: {
            colors: {
              foo: 'red',
            },
          },
        },
      }
    `,
    'tailwind.config.two.js': js`
      module.exports = {
        content: ['./two/**/*'],
        theme: {
          extend: {
            colors: {
              foo: 'blue',
            },
          },
        },
      }
    `,
  },
  prepare: async ({ root }) => ({ client: await createClient({ root }) }),
  handle: async ({ client }) => {
    let one = await client.open({
      lang: 'html',
      name: 'one/index.html',
      text: '<div class="bg-foo">',
    })

    let two = await client.open({
      lang: 'html',
      name: 'two/index.html',
      text: '<div class="bg-foo">',
    })

    // <div class="bg-foo">
    //             ^
    let hoverOne = await one.hover({ line: 0, character: 13 })
    let hoverTwo = await two.hover({ line: 0, character: 13 })

    expect(hoverOne).toEqual({
      contents: {
        language: 'css',
        value: dedent`
          .bg-foo {
            --tw-bg-opacity: 1;
            background-color: rgb(255 0 0 / var(--tw-bg-opacity, 1)) /* #ff0000 */;
          }
        `,
      },
      range: {
        start: { line: 0, character: 12 },
        end: { line: 0, character: 18 },
      },
    })

    expect(hoverTwo).toEqual({
      contents: {
        language: 'css',
        value: dedent`
          .bg-foo {
            --tw-bg-opacity: 1;
            background-color: rgb(0 0 255 / var(--tw-bg-opacity, 1)) /* #0000ff */;
          }
        `,
      },
      range: {
        start: { line: 0, character: 12 },
        end: { line: 0, character: 18 },
      },
    })
  },
})
