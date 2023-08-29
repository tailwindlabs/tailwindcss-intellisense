import { expect, test } from 'vitest'
import { withFixture } from '../common'
import * as fs from 'node:fs/promises'

withFixture('basic', (c) => {
  function testFixture(fixture) {
    test(fixture, async () => {
      fixture = await fs.readFile(`tests/diagnostics/${fixture}.json`, 'utf8')

      let { code, expected, language = 'html' } = JSON.parse(fixture)

      let promise = new Promise((resolve) => {
        c.onNotification('textDocument/publishDiagnostics', ({ diagnostics }) => {
          resolve(diagnostics)
        })
      })

      let doc = await c.openDocument({ text: code, lang: language })
      let diagnostics = await promise

      expected = JSON.parse(JSON.stringify(expected).replaceAll('{{URI}}', doc.uri))

      expect(diagnostics).toEqual(expected)
    })
  }

  testFixture('css-conflict/simple')
  testFixture('css-conflict/variants-negative')
  testFixture('css-conflict/variants-positive')
  testFixture('css-conflict/jsx-concat-negative')
  testFixture('css-conflict/jsx-concat-positive')
  testFixture('css-conflict/css')
  testFixture('css-conflict/css-multi-rule')
  testFixture('css-conflict/css-multi-prop')
  testFixture('invalid-screen/simple')
  testFixture('invalid-theme/simple')
})
