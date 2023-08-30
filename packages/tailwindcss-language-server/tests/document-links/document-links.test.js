import { test, expect } from 'vitest'
import { withFixture } from '../common'
import * as path from 'path'

withFixture('basic', (c) => {
  async function testDocumentLinks(name, { text, lang, expected }) {
    test.concurrent(name, async () => {
      let textDocument = await c.openDocument({ text, lang })
      let res = await c.sendRequest('textDocument/documentLink', {
        textDocument,
      })

      expect(res).toEqual(expected)
    })
  }

  testDocumentLinks('file exists', {
    text: '@config "tailwind.config.js";',
    lang: 'css',
    expected: [
      {
        target: `file://${path
          .resolve('./tests/fixtures/basic/tailwind.config.js')
          .replace(/@/g, '%40')}`,
        range: { start: { line: 0, character: 8 }, end: { line: 0, character: 28 } },
      },
    ],
  })

  testDocumentLinks('file does not exist', {
    text: '@config "does-not-exist.js";',
    lang: 'css',
    expected: [
      {
        target: `file://${path
          .resolve('./tests/fixtures/basic/does-not-exist.js')
          .replace(/@/g, '%40')}`,
        range: { start: { line: 0, character: 8 }, end: { line: 0, character: 27 } },
      },
    ],
  })
})
