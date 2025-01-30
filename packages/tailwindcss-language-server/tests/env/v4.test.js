import { expect } from 'vitest'
import { init } from '../common'
import { HoverRequest } from 'vscode-languageserver'
import { css, defineTest, js, json } from '../../src/testing'
import dedent from 'dedent'
import { CompletionRequest } from 'vscode-languageserver-protocol'

defineTest({
  name: 'v4, no npm, uses fallback',
  fs: {
    'app.css': css`
      @import 'tailwindcss';
    `,
  },
  prepare: async ({ root }) => ({ c: await init(root) }),
  handle: async ({ c }) => {
    let textDocument = await c.openDocument({
      lang: 'html',
      text: '<div class="bg-[#000]/25 hover:">',
    })

    expect(c.project).toMatchObject({
      tailwind: {
        version: '4.0.0',
        isDefaultVersion: true,
      },
    })

    let hover = await c.sendRequest(HoverRequest.type, {
      textDocument,

      // <div class="bg-[#000]/25 hover:
      //             ^
      position: { line: 0, character: 13 },
    })

    let completion = await c.sendRequest(CompletionRequest.type, {
      textDocument,
      context: { triggerKind: 1 },

      // <div class="bg-[#000]/25 hover:
      //                               ^
      position: { line: 0, character: 31 },
    })

    expect(hover).toEqual({
      contents: {
        language: 'css',
        value: dedent`
          .bg-\[\#000\]\/25 {
            background-color: color-mix(in oklab, #000 25%, transparent);
          }
        `,
      },
      range: {
        start: { line: 0, character: 12 },
        end: { line: 0, character: 24 },
      },
    })

    expect(completion.items.length).toBe(12286)
  },
})

defineTest({
  /**
   * Plugins and configs that import stuff from the `tailwindcss` package do
   * not work because we need to register ESM loader hooks as well as hooking
   * into require(), createRequire(), etc… even for require() used indirectly
   * through an ESM-imported file.
   *
   * This is not 100% possible before Node v23.6.0 but we should be able to get
   * close to that by using async loaders but there's still a lot of work to do
   * to make that a workable solution.
   */
  options: { skip: true },

  name: 'v4, no npm, with plugins',
  fs: {
    'app.css': css`
      @import 'tailwindcss';
      @plugin "./plugin.js";
    `,
    'plugin.js': js`
      import plugin from 'tailwindcss/plugin'

      export default plugin(function ({ addUtilities }) {
        addUtilities({
          '.example': {
            color: 'red',
          },
        })
      })
    `,
  },

  // Note this test MUST run in spawn mode because Vitest hooks into import,
  // require, etc… already and we need to test that any hooks are working
  // without outside interference.
  prepare: async ({ root }) => ({
    c: await init(root, { mode: 'spawn' }),
  }),

  handle: async ({ c }) => {
    let textDocument = await c.openDocument({
      lang: 'html',
      text: '<div class="underline example">',
    })

    expect(c.project).toMatchObject({
      tailwind: {
        version: '4.0.0',
        isDefaultVersion: true,
      },
    })

    let hover = await c.sendRequest(HoverRequest.type, {
      textDocument,

      // <div class="underline example">
      //             ^
      position: { line: 0, character: 13 },
    })

    expect(hover).toEqual({
      contents: {
        language: 'css',
        value: dedent`
          .underline {
            text-decoration-line: underline;
          }
        `,
      },
      range: {
        start: { line: 0, character: 12 },
        end: { line: 0, character: 21 },
      },
    })

    let hoverFromPlugin = await c.sendRequest(HoverRequest.type, {
      textDocument,

      // <div class="underline example">
      //                       ^
      position: { line: 0, character: 23 },
    })

    expect(hoverFromPlugin).toEqual({
      contents: {
        language: 'css',
        value: dedent`
          .example {
            color: red;
          }
        `,
      },
      range: {
        start: { line: 0, character: 22 },
        end: { line: 0, character: 29 },
      },
    })
  },
})

defineTest({
  name: 'v4, with npm, uses local',
  fs: {
    'package.json': json`
      {
        "dependencies": {
          "tailwindcss": "4.0.1"
        }
      }
    `,
    'app.css': css`
      @import 'tailwindcss';
    `,
  },
  prepare: async ({ root }) => ({ c: await init(root) }),
  handle: async ({ c }) => {
    let textDocument = await c.openDocument({
      lang: 'html',
      text: '<div class="bg-[#000]/25 hover:">',
    })

    expect(c.project).toMatchObject({
      tailwind: {
        version: '4.0.1',
        isDefaultVersion: false,
      },
    })

    let hover = await c.sendRequest(HoverRequest.type, {
      textDocument,

      // <div class="bg-[#000]/25 hover:
      //             ^
      position: { line: 0, character: 13 },
    })

    let completion = await c.sendRequest(CompletionRequest.type, {
      textDocument,
      context: { triggerKind: 1 },

      // <div class="bg-[#000]/25 hover:
      //                               ^
      position: { line: 0, character: 31 },
    })

    expect(hover).toEqual({
      contents: {
        language: 'css',
        value: dedent`
          .bg-\[\#000\]\/25 {
            background-color: color-mix(in oklab, #000 25%, transparent);
          }
        `,
      },
      range: {
        start: { line: 0, character: 12 },
        end: { line: 0, character: 24 },
      },
    })

    expect(completion.items.length).toBe(12288)
  },
})
