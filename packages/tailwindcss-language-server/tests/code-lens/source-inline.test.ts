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
    client: await createClient({
      root,
      features: ['source-inline'],
    }),
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

defineTest({
  name: 'The user is warned when @source inline(…) generates a lerge amount of CSS',
  fs: {
    'app.css': css`
      @import 'tailwindcss';
    `,
  },
  prepare: async ({ root }) => ({
    client: await createClient({
      root,
      features: ['source-inline'],
    }),
  }),
  handle: async ({ client }) => {
    let document = await client.open({
      lang: 'css',
      text: css`
        @import 'tailwindcss';
        @source inline("{,dark:}{,{sm,md,lg,xl,2xl}:}{,{hover,focus,active}:}{flex,underline,bg-red-{50,{100..900.100},950}{,/{0..100}}}");
      `,
    })

    let lenses = await document.codeLenses()

    expect(lenses).toEqual([
      {
        range: {
          start: { line: 1, character: 15 },
          end: { line: 1, character: 129 },
        },
        command: {
          title: 'Generates 14,784 classes',
          command: '',
        },
      },
      {
        range: {
          start: { line: 1, character: 15 },
          end: { line: 1, character: 129 },
        },
        command: {
          title: 'At least 3MB of CSS',
          command: '',
        },
      },
      {
        range: {
          start: { line: 1, character: 15 },
          end: { line: 1, character: 129 },
        },
        command: {
          title: 'This may slow down your bundler/browser',
          command: '',
        },
      },
    ])
  },
})
