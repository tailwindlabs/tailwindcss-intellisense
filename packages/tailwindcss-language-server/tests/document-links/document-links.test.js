import { test } from 'vitest'
import * as path from 'path'
import { URI } from 'vscode-uri'
import { withFixture } from '../common'

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
        target: URI.file(path.resolve('./tests/fixtures/basic/tailwind.config.js')).toString(),
        range: { start: { line: 0, character: 8 }, end: { line: 0, character: 28 } },
      },
    ],
  })

  testDocumentLinks('file does not exist', {
    text: '@config "does-not-exist.js";',
    lang: 'css',
    expected: [
      {
        target: URI.file(path.resolve('./tests/fixtures/basic/does-not-exist.js')).toString(),
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
        target: URI.file(path.resolve('./tests/fixtures/v4/basic/tailwind.config.js')).toString(),
        range: { start: { line: 0, character: 8 }, end: { line: 0, character: 28 } },
      },
    ],
  })

  testDocumentLinks('config: file does not exist', {
    text: '@config "does-not-exist.js";',
    lang: 'css',
    expected: [
      {
        target: URI.file(path.resolve('./tests/fixtures/v4/basic/does-not-exist.js')).toString(),
        range: { start: { line: 0, character: 8 }, end: { line: 0, character: 27 } },
      },
    ],
  })

  testDocumentLinks('plugin: file exists', {
    text: '@plugin "plugin.js";',
    lang: 'css',
    expected: [
      {
        target: URI.file(path.resolve('./tests/fixtures/v4/basic/plugin.js')).toString(),
        range: { start: { line: 0, character: 8 }, end: { line: 0, character: 19 } },
      },
    ],
  })

  testDocumentLinks('plugin: file does not exist', {
    text: '@plugin "does-not-exist.js";',
    lang: 'css',
    expected: [
      {
        target: URI.file(path.resolve('./tests/fixtures/v4/basic/does-not-exist.js')).toString(),
        range: { start: { line: 0, character: 8 }, end: { line: 0, character: 27 } },
      },
    ],
  })

  testDocumentLinks('source: file exists', {
    text: '@source "index.html";',
    lang: 'css',
    expected: [
      {
        target: URI.file(path.resolve('./tests/fixtures/v4/basic/index.html')).toString(),
        range: { start: { line: 0, character: 8 }, end: { line: 0, character: 20 } },
      },
    ],
  })

  testDocumentLinks('source: file does not exist', {
    text: '@source "does-not-exist.html";',
    lang: 'css',
    expected: [
      {
        target: URI.file(path.resolve('./tests/fixtures/v4/basic/does-not-exist.html')).toString(),
        range: { start: { line: 0, character: 8 }, end: { line: 0, character: 29 } },
      },
    ],
  })

  testDocumentLinks('source not: file exists', {
    text: '@source not "index.html";',
    lang: 'css',
    expected: [
      {
        target: URI.file(path.resolve('./tests/fixtures/v4/basic/index.html')).toString(),
        range: { start: { line: 0, character: 12 }, end: { line: 0, character: 24 } },
      },
    ],
  })

  testDocumentLinks('source not: file does not exist', {
    text: '@source not "does-not-exist.html";',
    lang: 'css',
    expected: [
      {
        target: URI.file(path.resolve('./tests/fixtures/v4/basic/does-not-exist.html')).toString(),
        range: { start: { line: 0, character: 12 }, end: { line: 0, character: 33 } },
      },
    ],
  })

  testDocumentLinks('@source inline(…)', {
    text: '@source inline("m-{1,2,3}");',
    lang: 'css',
    expected: [],
  })

  testDocumentLinks('@source not inline(…)', {
    text: '@source not inline("m-{1,2,3}");',
    lang: 'css',
    expected: [],
  })

  testDocumentLinks('Directories in source(…) show links', {
    text: `
      @import "tailwindcss" source("../../");
      @tailwind utilities source("../../");
    `,
    lang: 'css',
    expected: [
      {
        target: URI.file(path.resolve('./tests/fixtures')).toString(),
        range: { start: { line: 1, character: 35 }, end: { line: 1, character: 43 } },
      },
      {
        target: URI.file(path.resolve('./tests/fixtures')).toString(),
        range: { start: { line: 2, character: 33 }, end: { line: 2, character: 41 } },
      },
    ],
  })

  testDocumentLinks('Globs in source(…) do not show links', {
    text: `
      @import "tailwindcss" source("../{a,b,c}");
      @tailwind utilities source("../{a,b,c}");
    `,
    lang: 'css',
    expected: [],
  })

  testDocumentLinks('Windows paths in source(…) do not show links', {
    text: String.raw`
      @import "tailwindcss" source("..\foo\bar");
      @tailwind utilities source("..\foo\bar");

      @import "tailwindcss" source("C:\foo\bar");
      @tailwind utilities source("C:\foo\bar");

      @import "tailwindcss" source("C:foo");
      @tailwind utilities source("C:bar");
    `,
    lang: 'css',
    expected: [],
  })
})
