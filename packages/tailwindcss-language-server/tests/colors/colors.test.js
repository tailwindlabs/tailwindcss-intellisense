import { test, expect } from 'vitest'
import { init, withFixture } from '../common'
import { css, defineTest } from '../../src/testing'
import { DocumentColorRequest } from 'vscode-languageserver'

const color = (red, green, blue, alpha) => ({ red, green, blue, alpha })
const range = (startLine, startCol, endLine, endCol) => ({
  start: { line: startLine, character: startCol },
  end: { line: endLine, character: endCol },
})

withFixture('basic', (c) => {
  async function testColors(name, { text, expected }) {
    test.concurrent(name, async ({ expect }) => {
      let textDocument = await c.openDocument({ text })
      let res = await c.sendRequest('textDocument/documentColor', {
        textDocument,
      })

      expect(res).toEqual(expected)
    })
  }

  testColors('simple', {
    text: '<div class="bg-red-500">',
    expected: [
      {
        range: { start: { line: 0, character: 12 }, end: { line: 0, character: 22 } },
        color: {
          red: 0.9372549019607843,
          green: 0.26666666666666666,
          blue: 0.26666666666666666,
          alpha: 1,
        },
      },
    ],
  })

  testColors('opacity modifier', {
    text: '<div class="bg-red-500/20">',
    expected: [
      {
        range: { start: { line: 0, character: 12 }, end: { line: 0, character: 25 } },
        color: {
          red: 0.9372549019607843,
          green: 0.26666666666666666,
          blue: 0.26666666666666666,
          alpha: 0.2,
        },
      },
    ],
  })

  testColors('arbitrary value', {
    text: '<div class="bg-[red]">',
    expected: [
      {
        range: { start: { line: 0, character: 12 }, end: { line: 0, character: 20 } },
        color: {
          red: 1,
          green: 0,
          blue: 0,
          alpha: 1,
        },
      },
    ],
  })

  testColors('arbitrary value and opacity modifier', {
    text: '<div class="bg-[red]/[0.5]">',
    expected: [
      {
        range: { start: { line: 0, character: 12 }, end: { line: 0, character: 26 } },
        color: {
          red: 1,
          green: 0,
          blue: 0,
          alpha: 0.5,
        },
      },
    ],
  })

  testColors('oklch colors are parsed', {
    text: '<div class="bg-[oklch(60%_0.25_25)]">',
    expected: [
      {
        range: { start: { line: 0, character: 12 }, end: { line: 0, character: 35 } },
        color: {
          alpha: 1,
          red: 0.9475942429386454,
          green: 0,
          blue: 0.14005415620741646,
        },
      },
    ],
  })

  testColors('gradient utilities show colors', {
    text: '<div class="from-black from-black/50 via-black via-black/50 to-black to-black/50">',
    expected: [
      {
        range: { start: { line: 0, character: 12 }, end: { line: 0, character: 22 } },
        color: {
          alpha: 1,
          red: 0,
          green: 0,
          blue: 0,
        },
      },
      {
        range: { start: { line: 0, character: 23 }, end: { line: 0, character: 36 } },
        color: {
          alpha: 0.5,
          red: 0,
          green: 0,
          blue: 0,
        },
      },

      {
        range: { start: { line: 0, character: 37 }, end: { line: 0, character: 46 } },
        color: {
          alpha: 1,
          red: 0,
          green: 0,
          blue: 0,
        },
      },
      {
        range: { start: { line: 0, character: 47 }, end: { line: 0, character: 59 } },
        color: {
          alpha: 0.5,
          red: 0,
          green: 0,
          blue: 0,
        },
      },

      {
        range: { start: { line: 0, character: 60 }, end: { line: 0, character: 68 } },
        color: {
          alpha: 1,
          red: 0,
          green: 0,
          blue: 0,
        },
      },
      {
        range: { start: { line: 0, character: 69 }, end: { line: 0, character: 80 } },
        color: {
          alpha: 0.5,
          red: 0,
          green: 0,
          blue: 0,
        },
      },
    ],
  })
})

withFixture('v4/basic', (c) => {
  async function testColors(name, { text, expected }) {
    test.concurrent(name, async ({ expect }) => {
      let textDocument = await c.openDocument({ text })
      let res = await c.sendRequest('textDocument/documentColor', {
        textDocument,
      })

      expect(res).toEqual(expected)
    })
  }

  testColors('simple', {
    text: '<div class="bg-red-500">',
    expected: [
      {
        range: { start: { line: 0, character: 12 }, end: { line: 0, character: 22 } },
        color: {
          red: expect.closeTo(0.98, 0.01),
          green: expect.closeTo(0.172, 0.01),
          blue: expect.closeTo(0.21, 0.01),
          alpha: 1,
        },
      },
    ],
  })

  testColors('opacity modifier', {
    text: '<div class="bg-red-500/20">',
    expected: [
      {
        range: { start: { line: 0, character: 12 }, end: { line: 0, character: 25 } },
        color: {
          red: expect.closeTo(0.98, 0.01),
          green: expect.closeTo(0.172, 0.01),
          blue: expect.closeTo(0.21, 0.01),
          alpha: 0.2,
        },
      },
    ],
  })

  testColors('arbitrary value', {
    text: '<div class="bg-[red]">',
    expected: [
      {
        range: { start: { line: 0, character: 12 }, end: { line: 0, character: 20 } },
        color: {
          red: 1,
          green: 0,
          blue: 0,
          alpha: 1,
        },
      },
    ],
  })

  testColors('arbitrary value and opacity modifier', {
    text: '<div class="bg-[red]/[0.5]">',
    expected: [
      {
        range: { start: { line: 0, character: 12 }, end: { line: 0, character: 26 } },
        color: {
          red: 1,
          green: 0,
          blue: 0,
          alpha: 0.5,
        },
      },
    ],
  })

  testColors('oklch colors are parsed', {
    text: '<div class="bg-[oklch(60%_0.25_25)]">',
    expected: [
      {
        range: { start: { line: 0, character: 12 }, end: { line: 0, character: 35 } },
        color: {
          alpha: 1,
          red: 0.9475942429386454,
          green: 0,
          blue: 0.14005415620741646,
        },
      },
    ],
  })

  testColors('gradient utilities show colors', {
    text: '<div class="from-black from-black/50 via-black via-black/50 to-black to-black/50">',
    expected: [
      {
        range: { start: { line: 0, character: 12 }, end: { line: 0, character: 22 } },
        color: {
          alpha: 1,
          red: 0,
          green: 0,
          blue: 0,
        },
      },
      {
        range: { start: { line: 0, character: 23 }, end: { line: 0, character: 36 } },
        color: {
          alpha: 0.5,
          red: 0,
          green: 0,
          blue: 0,
        },
      },

      {
        range: { start: { line: 0, character: 37 }, end: { line: 0, character: 46 } },
        color: {
          alpha: 1,
          red: 0,
          green: 0,
          blue: 0,
        },
      },
      {
        range: { start: { line: 0, character: 47 }, end: { line: 0, character: 59 } },
        color: {
          alpha: 0.5,
          red: 0,
          green: 0,
          blue: 0,
        },
      },

      {
        range: { start: { line: 0, character: 60 }, end: { line: 0, character: 68 } },
        color: {
          alpha: 1,
          red: 0,
          green: 0,
          blue: 0,
        },
      },
      {
        range: { start: { line: 0, character: 69 }, end: { line: 0, character: 80 } },
        color: {
          alpha: 0.5,
          red: 0,
          green: 0,
          blue: 0,
        },
      },
    ],
  })
})

defineTest({
  name: 'v4: colors are recursively resolved from the theme',
  fs: {
    'app.css': css`
      @import 'tailwindcss';
      @theme {
        --color-*: initial;
        --color-primary: #ff0000;
        --color-level-1: var(--color-primary);
        --color-level-2: var(--color-level-1);
        --color-level-3: var(--color-level-2);
        --color-level-4: var(--color-level-3);
        --color-level-5: var(--color-level-4);
      }
    `,
  },
  prepare: async ({ root }) => ({ c: await init(root) }),
  handle: async ({ c }) => {
    let textDocument = await c.openDocument({
      lang: 'html',
      text: '<div class="bg-primary bg-level-1 bg-level-2 bg-level-3 bg-level-4 bg-level-5">',
    })

    expect(c.project).toMatchObject({
      tailwind: {
        version: '4.1.1',
        isDefaultVersion: true,
      },
    })

    let colors = await c.sendRequest(DocumentColorRequest.type, {
      textDocument,
    })

    expect(colors).toEqual([
      { range: range(0, 12, 0, 22), color: color(1, 0, 0, 1) },
      { range: range(0, 23, 0, 33), color: color(1, 0, 0, 1) },
      { range: range(0, 34, 0, 44), color: color(1, 0, 0, 1) },
      { range: range(0, 45, 0, 55), color: color(1, 0, 0, 1) },
      { range: range(0, 56, 0, 66), color: color(1, 0, 0, 1) },
      { range: range(0, 67, 0, 77), color: color(1, 0, 0, 1) },
    ])
  },
})

defineTest({
  name: 'colors that use light-dark() resolve to their light color',
  fs: {
    'app.css': css`
      @import 'tailwindcss';
      @theme {
        --color-primary: light-dark(#ff0000, #0000ff);
      }
    `,
  },
  prepare: async ({ root }) => ({ c: await init(root) }),
  handle: async ({ c }) => {
    let textDocument = await c.openDocument({
      lang: 'html',
      text: '<div class="bg-primary">',
    })

    expect(c.project).toMatchObject({
      tailwind: {
        version: '4.1.1',
        isDefaultVersion: true,
      },
    })

    let colors = await c.sendRequest(DocumentColorRequest.type, {
      textDocument,
    })

    expect(colors).toEqual([
      //
      { range: range(0, 12, 0, 22), color: color(1, 0, 0, 1) },
    ])
  },
})
