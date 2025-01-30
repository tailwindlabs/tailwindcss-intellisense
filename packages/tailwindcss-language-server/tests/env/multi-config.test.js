import { test } from 'vitest'
import { withFixture } from '../common'

withFixture('multi-config', (c) => {
  test.concurrent('multi-config 1', async ({ expect }) => {
    let textDocument = await c.openDocument({ text: '<div class="bg-foo">', dir: 'one' })
    let res = await c.sendRequest('textDocument/hover', {
      textDocument,
      position: { line: 0, character: 13 },
    })

    expect(res).toEqual({
      contents: {
        language: 'css',
        value:
          '.bg-foo {\n  --tw-bg-opacity: 1;\n  background-color: rgb(255 0 0 / var(--tw-bg-opacity, 1)) /* #ff0000 */;\n}',
      },
      range: { start: { line: 0, character: 12 }, end: { line: 0, character: 18 } },
    })
  })

  test.concurrent('multi-config 2', async ({ expect }) => {
    let textDocument = await c.openDocument({ text: '<div class="bg-foo">', dir: 'two' })
    let res = await c.sendRequest('textDocument/hover', {
      textDocument,
      position: { line: 0, character: 13 },
    })

    expect(res).toEqual({
      contents: {
        language: 'css',
        value:
          '.bg-foo {\n  --tw-bg-opacity: 1;\n  background-color: rgb(0 0 255 / var(--tw-bg-opacity, 1)) /* #0000ff */;\n}',
      },
      range: { start: { line: 0, character: 12 }, end: { line: 0, character: 18 } },
    })
  })
})
