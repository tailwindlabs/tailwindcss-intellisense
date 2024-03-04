import { test, expect } from 'vitest'
import { withFixture } from '../common'
import * as fs from 'node:fs/promises'

withFixture('v2', (c) => {
  function testFixture(fixture) {
    test(fixture, async () => {
      fixture = await fs.readFile(`tests/code-actions/${fixture}.json`, 'utf8')

      let { code, expected, language = 'html' } = JSON.parse(fixture)

      let promise = new Promise((resolve) => {
        c.onNotification('textDocument/publishDiagnostics', ({ diagnostics }) => {
          resolve(diagnostics)
        })
      })

      let textDocument = await c.openDocument({ text: code, lang: language })
      let diagnostics = await promise

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

  // testFixture('conflict')
  testFixture('invalid-theme')
  testFixture('invalid-screen')
  testFixture('invalid-variant')
})
