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
import { clearLanguageBoundariesCache } from '@tailwindcss/language-service/src/util/getLanguageBoundaries'
import { CacheMap } from '../src/cache-map'

type Settings = any

interface FixtureContext
  extends Pick<ProtocolConnection, 'sendRequest' | 'sendNotification' | 'onNotification'> {
  client: ProtocolConnection
  openDocument: (params: {
    text: string
    lang?: string
    dir?: string
    settings?: Settings
  }) => Promise<{ uri: string; updateSettings: (settings: Settings) => Promise<void> }>
  updateSettings: (settings: Settings) => Promise<void>
  updateFile: (file: string, text: string) => Promise<void>
  fixtureUri(fixture: string): string

  readonly project: {
    config: string
    tailwind: {
      version: string
      features: Feature[]
      isDefaultVersion: boolean
    }
  }
}

export interface InitOptions {
  /**
   * Extra initialization options to pass to the LSP
   */
  options?: Record<string, any>
}

export async function init(
  fixture: string | string[],
  opts: InitOptions = {},
): Promise<FixtureContext> {
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

  const fixtures = Array.isArray(fixture) ? fixture : [fixture]

  function fixtureUri(fixture: string) {
    return `file://${path.resolve('./tests/fixtures', fixture)}`
  }

  function resolveUri(...parts: string[]) {
    const filepath =
      fixtures.length > 1
        ? path.resolve('./tests/fixtures', ...parts)
        : path.resolve('./tests/fixtures', fixtures[0], ...parts)

    return `file://${filepath}`
  }

  const workspaceFolders = fixtures.map((fixture) => ({
    name: `Fixture ${fixture}`,
    uri: fixtureUri(fixture),
  }))

  const rootUri = fixtures.length > 1 ? null : workspaceFolders[0].uri

  await client.sendRequest(InitializeRequest.type, {
    processId: -1,
    rootUri,
    capabilities,
    trace: 'off',
    workspaceFolders,
    initializationOptions: {
      testMode: true,
      ...(opts.options ?? {}),
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

  interface PromiseWithResolvers<T> extends Promise<T> {
    resolve: (value?: T | PromiseLike<T>) => void
    reject: (reason?: any) => void
  }

  let openingDocuments = new CacheMap<string, PromiseWithResolvers<void>>()
  let projectDetails: any = null

  client.onNotification('@/tailwindCSS/projectDetails', (params) => {
    console.log('[TEST] Project detailed changed')
    projectDetails = params
  })

  client.onNotification('@/tailwindCSS/documentReady', (params) => {
    console.log('[TEST] Document ready', params.uri)
    openingDocuments.get(params.uri)?.resolve()
  })

  // This is a global cache that must be reset between tests for accurate results
  clearLanguageBoundariesCache()

  let counter = 0

  return {
    client,
    fixtureUri,
    get project() {
      return projectDetails
    },
    sendRequest(type: any, params: any) {
      return client.sendRequest(type, params)
    },
    sendNotification(type: any, params?: any) {
      return client.sendNotification(type, params)
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
      let uri = resolveUri(dir, `file-${counter++}`)
      docSettings.set(uri, settings)

      let openPromise = openingDocuments.remember(uri, () => {
        let resolve = () => {}
        let reject = () => {}

        let p = new Promise<void>((_resolve, _reject) => {
          resolve = _resolve
          reject = _reject
        })

        return Object.assign(p, {
          resolve,
          reject,
        })
      })

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
      await openPromise

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
      let uri = resolveUri(file)

      await client.sendNotification(DidChangeTextDocumentNotification.type, {
        textDocument: { uri, version: counter++ },
        contentChanges: [{ text }],
      })
    },
  }
}

export function withFixture(fixture: string, callback: (c: FixtureContext) => void) {
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

export function withWorkspace({
  fixtures,
  run,
}: {
  fixtures: string[]
  run: (c: FixtureContext) => void
}) {
  describe(`workspace: ${fixtures.join(', ')}`, () => {
    let c: FixtureContext = {} as any

    beforeAll(async () => {
      // Using the connection object as the prototype lets us access the connection
      // without defining getters for all the methods and also lets us add helpers
      // to the connection object without having to resort to using a Proxy
      Object.setPrototypeOf(c, await init(fixtures))

      return () => c.client.dispose()
    })

    run(c)
  })
}
