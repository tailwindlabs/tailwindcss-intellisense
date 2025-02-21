import { test } from 'vitest'
import { withWorkspace } from '../common'
import { DidChangeWorkspaceFoldersNotification, HoverRequest } from 'vscode-languageserver'

withWorkspace({
  fixtures: ['basic', 'v4/basic'],
  run(c) {
    test('basic: should provide hovers', async ({ expect }) => {
      let textDocument = await c.openDocument({
        dir: 'basic',
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

    test('v4/basic: should provide hovers', async ({ expect }) => {
      let textDocument = await c.openDocument({
        dir: 'v4/basic',
        text: '<div class="bg-[#000]">',
      })

      let res = await c.sendRequest(HoverRequest.type, {
        textDocument,
        position: { line: 0, character: 13 },
      })

      expect(res).toEqual({
        contents: {
          language: 'css',
          value: '.bg-\\[\\#000\\] {\n  background-color: #000;\n}',
        },
        range: { start: { line: 0, character: 12 }, end: { line: 0, character: 21 } },
      })
    })

    test('added workspaces can provide hovers', async ({ expect }) => {
      // Add a new workspace folder
      await c.sendNotification(DidChangeWorkspaceFoldersNotification.type, {
        event: {
          added: [
            {
              uri: c.fixtureUri('v3/ts-config'),
              name: 'added-workspace',
            },
          ],
          removed: [],
        },
      })

      // Hover a document in the new workspace
      let textDocument = await c.openDocument({
        dir: 'v3/ts-config',
        text: '<div class="bg-cool">',
      })

      let res = await c.sendRequest(HoverRequest.type, {
        textDocument,
        position: { line: 0, character: 13 },
      })

      expect(res).toEqual({
        contents: {
          language: 'css',
          value:
            '.bg-cool {\n  --tw-bg-opacity: 1;\n  background-color: rgb(0 0 255 / var(--tw-bg-opacity, 1)) /* #0000ff */;\n}',
        },
        range: { start: { line: 0, character: 12 }, end: { line: 0, character: 19 } },
      })
    })
  },
})
