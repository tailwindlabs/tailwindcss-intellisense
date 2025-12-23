import { test, expect } from 'vitest'
import * as fs from 'node:fs/promises'
import { withFixture } from '../common'

withFixture('v4/basic', (c) => {
  function testFixture(fixture) {
    test(fixture, async () => {
      fixture = await fs.readFile(`tests/code-actions/${fixture}.json`, 'utf8')

      let { code, expected, language = 'html' } = JSON.parse(fixture)

      let textDocument = await c.openDocument({ text: code, lang: language })
      let report = await c.sendRequest('textDocument/diagnostic', {
        textDocument: { uri: textDocument.uri },
      })
      let diagnostics = report.kind === 'unchanged' ? [] : report.items

      let res = await c.sendRequest('textDocument/codeAction', {
        textDocument,
        context: {
          diagnostics,
        },
      })

      expected = JSON.parse(JSON.stringify(expected).replaceAll('{{URI}}', textDocument.uri))

      expect(res).toEqual(expected)
    })
  }

  testFixture('conflict')
  // testFixture('invalid-theme')
  // testFixture('invalid-screen')
})
