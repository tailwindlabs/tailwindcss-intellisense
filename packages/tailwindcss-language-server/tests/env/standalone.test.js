import { expect } from 'vitest'
import { init } from '../common'
import { HoverRequest } from 'vscode-languageserver'
import { defineTest } from '../../src/testing'
import dedent from 'dedent'
import { CompletionRequest } from 'vscode-languageserver-protocol'

defineTest({
  name: 'v4, no npm, uses fallback',
  fs: {
    'app.css': `@import "tailwindcss";`,
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
