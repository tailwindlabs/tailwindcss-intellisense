import * as path from 'node:path'
import { beforeAll, describe } from 'vitest'
import { connect } from './connection'
import {
  CompletionRequest,
  ConfigurationRequest,
  DidChangeConfigurationNotification,
  DidChangeTextDocumentNotification,
  DidOpenTextDocumentNotification,
  InitializeRequest,
  InitializedNotification,
  RegistrationRequest,
  InitializeParams,
  DidOpenTextDocumentParams,
} from 'vscode-languageserver-protocol'
import type { ClientCapabilities, ProtocolConnection } from 'vscode-languageclient'
import type { Feature } from '@tailwindcss/language-service/src/features'

type Settings = any

interface FixtureContext extends Pick<ProtocolConnection, 'sendRequest' | 'onNotification'> {
  client: ProtocolConnection
  openDocument: (params: {
    text: string
    lang?: string
    dir?: string
    settings?: Settings
  }) => Promise<{ uri: string; updateSettings: (settings: Settings) => Promise<void> }>
  updateSettings: (settings: Settings) => Promise<void>
  updateFile: (file: string, text: string) => Promise<void>

  readonly project: {
    config: string
    tailwind: {
      version: string
      features: Feature[]
      isDefaultVersion: boolean
    }
  }
}

async function init(fixture: string): Promise<FixtureContext> {
  let settings = {}
  let docSettings = new Map<string, Settings>()

  const { client } = await connect()

  const capabilities: ClientCapabilities = {
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
    experimental: {
      tailwind: {
        projectDetails: true,
      },
    },
  }

  await client.sendRequest(InitializeRequest.type, {
    processId: -1,
    // rootPath: '.',
    rootUri: `file://${path.resolve('./tests/fixtures/', fixture)}`,
    capabilities,
    trace: 'off',
    workspaceFolders: [],
    initializationOptions: {
      testMode: true,
    },
  } as InitializeParams)

  await client.sendNotification(InitializedNotification.type)

  client.onRequest(ConfigurationRequest.type, (params) => {
    return params.items.map((item) => {
      if (docSettings.has(item.scopeUri!)) {
        return docSettings.get(item.scopeUri!)[item.section!] ?? {}
      }
      return settings[item.section!] ?? {}
    })
  })

  let initPromise = new Promise<void>((resolve) => {
    client.onRequest(RegistrationRequest.type, ({ registrations }) => {
      if (registrations.some((r) => r.method === CompletionRequest.method)) {
        resolve()
      }

      return null
    })
  })

  let projectDetails: any = null

  client.onNotification('@/tailwindCSS/projectDetails', (params) => {
    console.log('[TEST] Project detailed changed')
    projectDetails = params
  })

  let counter = 0

  return {
    client,
    get project() {
      return projectDetails
    },
    sendRequest(type: any, params: any) {
      return client.sendRequest(type, params)
    },
    onNotification(type: any, callback: any) {
      return client.onNotification(type, callback)
    },
    async openDocument({
      text,
      lang = 'html',
      dir = '',
      settings = {},
    }: {
      text: string
      lang?: string
      dir?: string
      settings?: Settings
    }) {
      let uri = `file://${path.resolve('./tests/fixtures', fixture, dir, `file-${counter++}`)}`
      docSettings.set(uri, settings)

      await client.sendNotification(DidOpenTextDocumentNotification.type, {
        textDocument: {
          uri,
          languageId: lang,
          version: 1,
          text,
        },
      } as DidOpenTextDocumentParams)

      // If opening a document stalls then it's probably because this promise is not being resolved
      // This can happen if a document is not covered by one of the selectors because of it's URI
      await initPromise

      return {
        uri,
        async updateSettings(settings: Settings) {
          docSettings.set(uri, settings)
          await client.sendNotification(DidChangeConfigurationNotification.type)
        },
      }
    },

    async updateSettings(newSettings: Settings) {
      settings = newSettings
      await client.sendNotification(DidChangeConfigurationNotification.type)
    },

    async updateFile(file: string, text: string) {
      let uri = `file://${path.resolve('./tests/fixtures', fixture, file)}`

      await client.sendNotification(DidChangeTextDocumentNotification.type, {
        textDocument: { uri, version: counter++ },
        contentChanges: [{ text }],
      })
    },
  }
}

export function withFixture(fixture, callback: (c: FixtureContext) => void) {
  describe(fixture, () => {
    let c: FixtureContext = {} as any

    beforeAll(async () => {
      // Using the connection object as the prototype lets us access the connection
      // without defining getters for all the methods and also lets us add helpers
      // to the connection object without having to resort to using a Proxy
      Object.setPrototypeOf(c, await init(fixture))

      return () => c.client.dispose()
    })

    callback(c)
  })
}
