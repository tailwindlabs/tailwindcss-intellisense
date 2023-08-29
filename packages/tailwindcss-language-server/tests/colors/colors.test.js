import { test, expect } from 'vitest'
import { withFixture } from '../common'

withFixture('basic', (c) => {
  async function testColors(name, { text, expected }) {
    test.concurrent(name, async () => {
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
    text: '<div class="bg-[red]/[0.33]">',
    expected: [
      {
        range: { start: { line: 0, character: 12 }, end: { line: 0, character: 27 } },
        color: {
          red: 1,
          green: 0,
          blue: 0,
          alpha: 0.33,
        },
      },
    ],
  })
})
