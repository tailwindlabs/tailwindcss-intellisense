import { test, expect } from 'vitest'
import * as fs from 'node:fs/promises'
import { withFixture } from '../common'

withFixture('basic', (c) => {
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
      // console.log(JSON.stringify(res))

      expected = JSON.parse(JSON.stringify(expected).replaceAll('{{URI}}', textDocument.uri))

      expect(res).toEqual(expected)
    })
  }

  testFixture('conflict')
  testFixture('invalid-theme')
  testFixture('invalid-screen')
})
