import { test } from 'vitest'
import { withFixture } from '../common'
import * as path from 'path'

withFixture('basic', (c) => {
  async function testDocumentLinks(name, { text, lang, expected }) {
    test.concurrent(name, async ({ expect }) => {
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

withFixture('v4/basic', (c) => {
  async function testDocumentLinks(name, { text, lang, expected }) {
    test.concurrent(name, async ({ expect }) => {
      let textDocument = await c.openDocument({ text, lang })
      let res = await c.sendRequest('textDocument/documentLink', {
        textDocument,
      })

      expect(res).toEqual(expected)
    })
  }

  testDocumentLinks('config: file exists', {
    text: '@config "tailwind.config.js";',
    lang: 'css',
    expected: [
      {
        target: `file://${path
          .resolve('./tests/fixtures/v4/basic/tailwind.config.js')
          .replace(/@/g, '%40')}`,
        range: { start: { line: 0, character: 8 }, end: { line: 0, character: 28 } },
      },
    ],
  })

  testDocumentLinks('config: file does not exist', {
    text: '@config "does-not-exist.js";',
    lang: 'css',
    expected: [
      {
        target: `file://${path
          .resolve('./tests/fixtures/v4/basic/does-not-exist.js')
          .replace(/@/g, '%40')}`,
        range: { start: { line: 0, character: 8 }, end: { line: 0, character: 27 } },
      },
    ],
  })

  testDocumentLinks('plugin: file exists', {
    text: '@plugin "plugin.js";',
    lang: 'css',
    expected: [
      {
        target: `file://${path
          .resolve('./tests/fixtures/v4/basic/plugin.js')
          .replace(/@/g, '%40')}`,
        range: { start: { line: 0, character: 8 }, end: { line: 0, character: 19 } },
      },
    ],
  })

  testDocumentLinks('plugin: file does not exist', {
    text: '@plugin "does-not-exist.js";',
    lang: 'css',
    expected: [
      {
        target: `file://${path
          .resolve('./tests/fixtures/v4/basic/does-not-exist.js')
          .replace(/@/g, '%40')}`,
        range: { start: { line: 0, character: 8 }, end: { line: 0, character: 27 } },
      },
    ],
  })

  testDocumentLinks('source: file exists', {
    text: '@source "index.html";',
    lang: 'css',
    expected: [
      {
        target: `file://${path
          .resolve('./tests/fixtures/v4/basic/index.html')
          .replace(/@/g, '%40')}`,
        range: { start: { line: 0, character: 8 }, end: { line: 0, character: 20 } },
      },
    ],
  })

  testDocumentLinks('source: file does not exist', {
    text: '@source "does-not-exist.html";',
    lang: 'css',
    expected: [
      {
        target: `file://${path
          .resolve('./tests/fixtures/v4/basic/does-not-exist.html')
          .replace(/@/g, '%40')}`,
        range: { start: { line: 0, character: 8 }, end: { line: 0, character: 29 } },
      },
    ],
  })
})
