import { expect } from 'vitest'
import { css, defineTest } from '../../src/testing'
import { createClient } from '../utils/client'

defineTest({
  name: 'Code lenses are displayed for @source inline(…)',
  fs: {
    'app.css': css`
      @import 'tailwindcss';
    `,
  },
  prepare: async ({ root }) => ({
    client: await createClient({ root }),
  }),
  handle: async ({ client }) => {
    let document = await client.open({
      lang: 'css',
      text: css`
        @import 'tailwindcss';
        @source inline("{,{hover,focus}:}{flex,underline,bg-red-{50,{100..900.100},950}}");
      `,
    })

    let lenses = await document.codeLenses()

    expect(lenses).toEqual([
      {
        range: {
          start: { line: 1, character: 15 },
          end: { line: 1, character: 81 },
        },
        command: {
          title: 'Generates 15 classes',
          command: '',
        },
      },
    ])
  },
})
