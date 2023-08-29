import * as path from 'node:path'
import * as cp from 'node:child_process'
import * as rpc from 'vscode-jsonrpc'
import { beforeAll } from 'vitest'

let settings = {}
let initPromise
let childProcess
let docSettings = new Map()

async function init(fixture) {
  childProcess = cp.fork('./bin/tailwindcss-language-server', { silent: true })

  const capabilities = {
    textDocument: {
      codeAction: { dynamicRegistration: true },
      codeLens: { dynamicRegistration: true },
      colorProvider: { dynamicRegistration: true },
      completion: {
        completionItem: {
          commitCharactersSupport: true,
          documentationFormat: ['markdown', 'plaintext'],
          snippetSupport: true,
        },
        completionItemKind: {
          valueSet: [
            1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24,
            25,
          ],
        },
        contextSupport: true,
        dynamicRegistration: true,
      },
      definition: { dynamicRegistration: true },
      documentHighlight: { dynamicRegistration: true },
      documentLink: { dynamicRegistration: true },
      documentSymbol: {
        dynamicRegistration: true,
        symbolKind: {
          valueSet: [
            1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24,
            25, 26,
          ],
        },
      },
      formatting: { dynamicRegistration: true },
      hover: {
        contentFormat: ['markdown', 'plaintext'],
        dynamicRegistration: true,
      },
      implementation: { dynamicRegistration: true },
      onTypeFormatting: { dynamicRegistration: true },
      publishDiagnostics: { relatedInformation: true },
      rangeFormatting: { dynamicRegistration: true },
      references: { dynamicRegistration: true },
      rename: { dynamicRegistration: true },
      signatureHelp: {
        dynamicRegistration: true,
        signatureInformation: { documentationFormat: ['markdown', 'plaintext'] },
      },
      synchronization: {
        didSave: true,
        dynamicRegistration: true,
        willSave: true,
        willSaveWaitUntil: true,
      },
      typeDefinition: { dynamicRegistration: true },
    },
    workspace: {
      applyEdit: true,
      configuration: true,
      didChangeConfiguration: { dynamicRegistration: true },
      didChangeWatchedFiles: { dynamicRegistration: true },
      executeCommand: { dynamicRegistration: true },
      symbol: {
        dynamicRegistration: true,
        symbolKind: {
          valueSet: [
            1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24,
            25, 26,
          ],
        },
      },
      workspaceEdit: { documentChanges: true },
      workspaceFolders: true,
    },
  }

  let connection = rpc.createMessageConnection(
    new rpc.StreamMessageReader(childProcess.stdout),
    new rpc.StreamMessageWriter(childProcess.stdin)
  )

  connection.listen()

  await connection.sendRequest(new rpc.RequestType('initialize'), {
    processId: -1,
    // rootPath: '.',
    rootUri: `file://${path.resolve('./tests/fixtures/', fixture)}`,
    capabilities,
    trace: 'off',
    workspaceFolders: [],
    initializationOptions: {
      testMode: true,
    },
  })

  await connection.sendNotification(new rpc.NotificationType('initialized'))

  connection.onRequest(new rpc.RequestType('workspace/configuration'), (params) => {
    return params.items.map((item) => {
      if (docSettings.has(item.scopeUri)) {
        return docSettings.get(item.scopeUri)[item.section] ?? {}
      }
      return settings[item.section] ?? {}
    })
  })

  initPromise = new Promise((resolve) => {
    connection.onRequest(new rpc.RequestType('client/registerCapability'), ({ registrations }) => {
      if (registrations.findIndex((r) => r.method === 'textDocument/completion') > -1) {
        resolve()
      }
      return null
    })
  })

  let counter = 0

  return {
    connection,
    sendRequest(type, params) {
      return connection.sendRequest(new rpc.RequestType(type), params)
    },
    onNotification(type, callback) {
      return connection.onNotification(new rpc.RequestType(type), callback)
    },
    async openDocument({ text, lang = 'html', dir = '', settings = {} }) {
      let uri = `file://${path.resolve('./tests/fixtures', fixture, dir, `file-${counter++}`)}`
      docSettings.set(uri, settings)
      await connection.sendNotification(new rpc.NotificationType('textDocument/didOpen'), {
        textDocument: {
          uri,
          languageId: lang,
          version: 1,
          text,
        },
      })

      await initPromise

      return {
        uri,
        async updateSettings(settings) {
          docSettings.set(uri, settings)
          await connection.sendNotification(
            new rpc.NotificationType('workspace/didChangeConfiguration')
          )
        },
      }
    },
    async updateSettings(newSettings) {
      settings = newSettings
      await connection.sendNotification(
        new rpc.NotificationType('workspace/didChangeConfiguration')
      )
    },
    async updateFile(file, text) {
      let uri = `file://${path.resolve('./tests/fixtures', fixture, file)}`

      await connection.sendNotification(new rpc.NotificationType('textDocument/didChange'), {
        textDocument: { uri, version: counter++ },
        contentChanges: [{ text }],
      })
    },
  }
}

export function withFixture(fixture, callback) {
  let c

  beforeAll(async () => {
    c = await init(fixture)
    return () => c.connection.end()
  })

  callback({
    get connection() {
      return c.connection
    },
    get sendRequest() {
      return c.sendRequest
    },
    get onNotification() {
      return c.onNotification
    },
    get openDocument() {
      return c.openDocument
    },
    get updateSettings() {
      return c.updateSettings
    },
    get updateFile() {
      return c.updateFile
    },
  })
}

// let counter = 0

// export async function openDocument(connection, fixture, languageId, text) {
//   let uri = `file://${path.resolve('./tests/fixtures', fixture, `file-${counter++}`)}`

//   await connection.sendNotification(new rpc.NotificationType('textDocument/didOpen'), {
//     textDocument: {
//       uri,
//       languageId,
//       version: 1,
//       text,
//     },
//   })

//   await initPromise

//   return uri
// }

// export async function updateSettings(connection, newSettings) {
//   settings = newSettings
//   await connection.sendNotification(new rpc.NotificationType('workspace/didChangeConfiguration'))
// }
