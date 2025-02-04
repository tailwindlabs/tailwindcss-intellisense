import { test } from 'vitest'
import * as path from 'node:path'
import { withFixture, withWorkspace } from '../common'
import { DidChangeWorkspaceFoldersNotification, HoverRequest } from 'vscode-languageserver'

withFixture('document-selection/basic', (c) => {
  test('basic: should provide hovers', async ({ expect }) => {
    let textDocument = await c.openDocument({
      text: '<div class="bg-[#000]">',
    })

    let res = await c.sendRequest(HoverRequest.type, {
      textDocument,
      position: { line: 0, character: 13 },
    })

    expect(res).toEqual({
      contents: {
        language: 'css',
        value:
          '.bg-\\[\\#000\\] {\n  --tw-bg-opacity: 1;\n  background-color: rgb(0 0 0 / var(--tw-bg-opacity, 1)) /* #000000 */;\n}',
      },
      range: { start: { line: 0, character: 12 }, end: { line: 0, character: 21 } },
    })
  })
})

withFixture('document-selection/(parens)', (c) => {
  test('parens: should provide hovers', async ({ expect }) => {
    let textDocument = await c.openDocument({
      text: '<div class="bg-[#000]">',
    })

    let res = await c.sendRequest(HoverRequest.type, {
      textDocument,
      position: { line: 0, character: 13 },
    })

    expect(res).toEqual({
      contents: {
        language: 'css',
        value:
          '.bg-\\[\\#000\\] {\n  --tw-bg-opacity: 1;\n  background-color: rgb(0 0 0 / var(--tw-bg-opacity, 1)) /* #000000 */;\n}',
      },
      range: { start: { line: 0, character: 12 }, end: { line: 0, character: 21 } },
    })
  })
})

withFixture('document-selection/[brackets]', (c) => {
  test('brackets: should provide hovers', async ({ expect }) => {
    let textDocument = await c.openDocument({
      text: '<div class="bg-[#000]">',
    })

    let res = await c.sendRequest(HoverRequest.type, {
      textDocument,
      position: { line: 0, character: 13 },
    })

    expect(res).toEqual({
      contents: {
        language: 'css',
        value:
          '.bg-\\[\\#000\\] {\n  --tw-bg-opacity: 1;\n  background-color: rgb(0 0 0 / var(--tw-bg-opacity, 1)) /* #000000 */;\n}',
      },
      range: { start: { line: 0, character: 12 }, end: { line: 0, character: 21 } },
    })
  })
})

withFixture('document-selection/{curlies}', (c) => {
  test('curlies: should provide hovers', async ({ expect }) => {
    let textDocument = await c.openDocument({
      text: '<div class="bg-[#000]">',
    })

    let res = await c.sendRequest(HoverRequest.type, {
      textDocument,
      position: { line: 0, character: 13 },
    })

    expect(res).toEqual({
      contents: {
        language: 'css',
        value:
          '.bg-\\[\\#000\\] {\n  --tw-bg-opacity: 1;\n  background-color: rgb(0 0 0 / var(--tw-bg-opacity, 1)) /* #000000 */;\n}',
      },
      range: { start: { line: 0, character: 12 }, end: { line: 0, character: 21 } },
    })
  })
})
