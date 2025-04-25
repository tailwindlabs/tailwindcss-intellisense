import type { Settings } from '@tailwindcss/language-service/src/util/state'
import {
  ClientCapabilities,
  CodeLens,
  CodeLensRequest,
  CompletionList,
  CompletionParams,
  Diagnostic,
  DidChangeWatchedFilesNotification,
  Disposable,
  DocumentLink,
  DocumentLinkRequest,
  DocumentSymbol,
  DocumentSymbolRequest,
  FileChangeType,
  FileEvent,
  Hover,
  NotificationHandler,
  ProtocolConnection,
  PublishDiagnosticsParams,
  Registration,
  SymbolInformation,
  UnregistrationRequest,
  WorkspaceFolder,
} from 'vscode-languageserver'
import type { Position } from 'vscode-languageserver-textdocument'
import {
  ConfigurationRequest,
  HoverRequest,
  DidOpenTextDocumentNotification,
  CompletionRequest,
  DidChangeConfigurationNotification,
  DidChangeTextDocumentNotification,
  DidCloseTextDocumentNotification,
  PublishDiagnosticsNotification,
  InitializeRequest,
  InitializedNotification,
  RegistrationRequest,
  MessageType,
  LogMessageNotification,
} from 'vscode-languageserver'
import { URI, Utils as URIUtils } from 'vscode-uri'
import {
  DocumentReady,
  DocumentReadyNotification,
  ProjectDetails,
  ProjectDetailsNotification,
} from './messages'
import { createConfiguration, Configuration } from './configuration'
import { clearLanguageBoundariesCache } from '@tailwindcss/language-service/src/util/getLanguageBoundaries'
import { DefaultMap } from '../../src/util/default-map'
import { connect, ConnectOptions } from './connection'
import type { DeepPartial } from '@tailwindcss/language-service/src/types'
import type { Feature } from '@tailwindcss/language-service/src/features'

export interface DocumentDescriptor {
  /**
   * The language the document is written in
   */
  lang: string

  /**
   * The content of the document
   */
  text: string

  /**
   * The name or file path to the document
   *
   * By default a unique path is generated at the root of the workspace
   *
   * Mutually exclusive with `uri`. If both are given `uri` takes precedence
   */
  name?: string

  /**
   * A full URI to the document
   *
   * Mutually exclusive with `name`. If both are given`uri` takes precedence
   *
   * @deprecated use `name` instead
   */
  uri?: string

  /**
   * Any document-specific language-server settings
   */
  settings?: Settings
}

export interface ChangedFiles {
  created?: string[]
  changed?: string[]
  deleted?: string[]
}

export interface ClientDocument {
  /**
   * The URI to the document
   */
  uri: URI

  /**
   * Re-open the document after it has been closed
   *
   * You may not open a document that is already open
   */
  reopen(): Promise<void>

  /**
   * Code lenses in the document
   */
  codeLenses(): Promise<CodeLens[] | null>

  /**
   * The diagnostics for the current version of this document
   */
  diagnostics(): Promise<Diagnostic[]>

  /**
   * Links in the document
   */
  links(): Promise<DocumentLink[] | null>

  /**
   * The diagnostics for the current version of this document
   */
  symbols(): Promise<DocumentSymbol[] | SymbolInformation[] | null>

  /**
   * Update the document with new information
   *
   * Renaming a document is not allowed nor is changing its language
   */
  update(desc: Partial<DocumentDescriptor>): Promise<void>

  /**
   * Close the document
   */
  close(): Promise<void>

  /**
   * Trigger a hover request at the given position
   */
  hover(position: Position): Promise<Hover | null>

  /**
   * Trigger completions at the given position
   */
  completions(position: Position): Promise<CompletionList | null>
  completions(params: Omit<CompletionParams, 'textDocument'>): Promise<CompletionList | null>
}

export interface ClientOptions extends ConnectOptions {
  /**
   * The path to the workspace root
   *
   * In the case of multiple workspaces this should be an object with names as
   * keys and paths as values. These names can then be used in `workspace()`
   * to open documents in a specific workspace
   *
   * The server is *NOT* run from any of these directories so no assumptions
   * are made about where the server is running.
   */
  root: string | Record<string, string>

  /**
   * Initialization options to pass to the LSP
   */
  options?: Record<string, any>

  /**
   * Whether or not to log `window/logMessage` events
   *
   * If a server is running in-process this could be noisy as lots of logs
   * would be duplicated
   */
  log?: boolean

  /**
   * Settings to provide the server immediately when it starts
   */
  settings?: DeepPartial<Settings>

  /**
   * Additional features to force-enable
   *
   * These should normally be enabled by the server based on the project
   * and the Tailwind CSS version it detects
   */
  features?: Feature[]

  /**
   * Tweak the client capabilities presented to the server
   */
  capabilities?(caps: ClientCapabilities): ClientCapabilities | Promise<ClientCapabilities> | void
}

export interface Client extends ClientWorkspace {
  /**
   * The connection from the client to the server
   */
  readonly conn: ProtocolConnection

  /**
   * Get the currently registered server capabilities
   */
  serverCapabilities: Registration[]

  /**
   * Get the currently registered server capabilities
   */
  onServerCapabilitiesChanged(cb: () => void): void

  /**
   * Tell the server that files on disk have changed
   */
  notifyChangedFiles(changes: ChangedFiles): Promise<void>

  /**
   * Get a workspace by name
   */
  workspace(name: string): Promise<ClientWorkspace | null>

  /**
   * Update the global settings for the server
   */
  updateSettings(settings: DeepPartial<Settings>): Promise<void>
}

export interface ClientWorkspaceOptions {
  /**
   * The connection from the client to the server
   */
  conn: ProtocolConnection

  /**
   * The folder this workspace is in
   */
  folder: WorkspaceFolder

  /**
   * The client settings cache
   */
  configuration: Configuration

  /**
   * A handler that can be used to request diagnostics for a document
   */
  notifications: ClientNotifications
}

/**
 * Represents an open workspace
 */
export interface ClientWorkspace {
  /**
   * The connection from the client to the server
   */
  conn: ProtocolConnection

  /**
   * The name of this workspace
   */
  name: string

  /**
   * Open a document
   */
  open(desc: DocumentDescriptor): Promise<ClientDocument>

  /**
   * Update the settings for this workspace
   */
  updateSettings(settings: Settings): Promise<void>

  /**
   * Get the details of the project
   */
  project(): Promise<ProjectDetails>
}

function trace(msg: string, ...args: any[]) {
  console.log(
    // `${styleText(['bold', 'blue', 'inverse'], ' TEST ')} ${styleText('dim', msg)}`,
    ` TEST ${msg}`,
    ...args,
  )
}

export async function createClient(opts: ClientOptions): Promise<Client> {
  trace('Starting server')

  let conn = connect(opts)

  let initDone = () => {}
  let initPromise = new Promise<void>((resolve) => {
    initDone = resolve
  })

  let workspaceFolders: WorkspaceFolder[]

  if (typeof opts.root === 'string') {
    workspaceFolders = [
      {
        name: 'default',
        uri: URI.file(opts.root).toString(),
      },
    ]
  } else {
    workspaceFolders = Object.entries(opts.root).map(([name, uri]) => ({
      name,
      uri: URI.file(uri).toString(),
    }))
  }

  if (workspaceFolders.length === 0) throw new Error('No workspaces provided')

  trace('Workspace folders')
  for (let folder of workspaceFolders) {
    trace(`- ${folder.name}: ${folder.uri}`)
  }

  function rewriteUri(url: string | URI | undefined) {
    if (!url) return undefined

    let str = typeof url === 'string' ? url : url.toString()

    for (let folder of workspaceFolders) {
      if (str.startsWith(`${folder.uri}/`)) {
        return str.replace(`${folder.uri}/`, `{workspace:${folder.name}}/`)
      }
    }

    return str
  }

  // This is a global cache that must be reset between tests for accurate results
  clearLanguageBoundariesCache()

  let configuration = createConfiguration()

  if (opts.settings) {
    configuration.set(null, opts.settings)
  }

  let capabilities: ClientCapabilities = {
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

  capabilities = (await opts.capabilities?.(capabilities)) ?? capabilities

  trace('Client initializing')
  await conn.sendRequest(InitializeRequest.type, {
    processId: process.pid,
    rootUri: workspaceFolders.length > 1 ? null : workspaceFolders[0].uri,
    capabilities,
    trace: 'off',
    workspaceFolders,
    initializationOptions: {
      testMode: true,
      additionalFeatures: opts.features,
      ...opts.options,
    },
  })

  if (opts.log) {
    conn.onNotification(LogMessageNotification.type, ({ message, type }) => {
      if (type === MessageType.Error) {
        console.error(message)
      } else if (type === MessageType.Warning) {
        console.warn(message)
      } else if (type === MessageType.Info) {
        console.info(message)
      } else if (type === MessageType.Log) {
        console.log(message)
      }
    })
  }

  let serverCapabilityChangeCallbacks: (() => void)[] = []

  function onServerCapabilitiesChanged(cb: () => void) {
    serverCapabilityChangeCallbacks.push(cb)
  }

  let registeredCapabilities: Registration[] = []

  conn.onRequest(RegistrationRequest.type, ({ registrations }) => {
    trace('Registering capabilities')

    for (let registration of registrations) {
      registeredCapabilities.push(registration)
      trace('-', registration.method)
    }

    for (let cb of serverCapabilityChangeCallbacks) cb()
  })

  conn.onRequest(UnregistrationRequest.type, ({ unregisterations }) => {
    trace('Unregistering capabilities')

    let idsToRemove = new Set<string>()

    for (let registration of unregisterations) {
      idsToRemove.add(registration.id)
      trace('-', registration.method)
    }

    registeredCapabilities = registeredCapabilities.filter(
      (capability) => !idsToRemove.has(capability.id),
    )

    for (let cb of serverCapabilityChangeCallbacks) cb()
  })

  // TODO: Remove this its a hack
  conn.onNotification('@/tailwindCSS/serverReady', () => {
    initDone()
  })

  // Handle requests for workspace configurations
  conn.onRequest(ConfigurationRequest.type, ({ items }) => {
    return items.map((item) => {
      trace('Requesting configuration')
      trace('- scope:', rewriteUri(item.scopeUri))
      trace('- section:', item.section)

      let sections = configuration.get(item.scopeUri ?? '/')

      if (item.section) {
        return sections[item.section] ?? {}
      }

      return sections
    })
  })

  let notifications = await createDocumentNotifications(conn)

  let clientWorkspaces: ClientWorkspace[] = []

  for (const folder of workspaceFolders) {
    clientWorkspaces.push(
      await createClientWorkspace({
        conn,
        folder,
        configuration,
        notifications,
      }),
    )
  }

  // Tell the server we're ready to receive requests and notifications
  await conn.sendNotification(InitializedNotification.type)
  trace('Client initializied')

  async function updateSettings(settings: Settings) {
    configuration.set(null, settings)
    await conn.sendNotification(DidChangeConfigurationNotification.type, {
      settings,
    })
  }

  async function workspace(name: string) {
    return clientWorkspaces.find((w) => w.name === name) ?? null
  }

  // TODO: Remove this, it's a bit of a hack
  if (opts.server === 'tailwindcss') {
    await initPromise
  }

  function notifyChangedFiles(changes: ChangedFiles) {
    let events: FileEvent[] = []

    for (const path of changes?.created ?? []) {
      events.push({ uri: URI.file(path).toString(), type: FileChangeType.Created })
    }

    for (const path of changes?.changed ?? []) {
      events.push({ uri: URI.file(path).toString(), type: FileChangeType.Changed })
    }

    for (const path of changes?.deleted ?? []) {
      events.push({ uri: URI.file(path).toString(), type: FileChangeType.Deleted })
    }

    return conn.sendNotification(DidChangeWatchedFilesNotification.type, {
      changes: events,
    })
  }

  return {
    ...clientWorkspaces[0],
    get serverCapabilities() {
      return registeredCapabilities
    },
    onServerCapabilitiesChanged,
    notifyChangedFiles,
    workspace,
    updateSettings,
  }
}

export async function createClientWorkspace({
  conn,
  folder,
  configuration,
  notifications,
}: ClientWorkspaceOptions): Promise<ClientWorkspace> {
  function rewriteUri(url: string | URI) {
    let str = typeof url === 'string' ? url : url.toString()
    if (str.startsWith(`${folder.uri}/`)) {
      return str.replace(`${folder.uri}/`, `{workspace:${folder.name}}/`)
    }
  }

  // TODO: Make this a request instead of a notification
  let projectDetails = new Promise<ProjectDetails>((resolve) => {
    notifications.onProjectDetails(folder.uri, (params) => {
      trace(`Project details changed:`)
      trace(`- ${rewriteUri(params.config)}`)
      trace(`- v${params.tailwind.version}`)
      trace(`- ${params.tailwind.isDefaultVersion ? 'bundled' : 'local'}`)
      trace(`- ${params.tailwind.features.join(', ')}`)
      resolve(params)
    })
  })

  let index = 0
  async function createClientDocument(desc: DocumentDescriptor): Promise<ClientDocument> {
    let state: 'closed' | 'opening' | 'opened' = 'closed'

    let uri = desc.uri
      ? URI.parse(desc.uri)
      : URIUtils.resolvePath(
          URI.parse(folder.uri),
          desc.name ? desc.name : `file-${++index}.${desc.lang}`,
        )

    let version = 1
    let currentDiagnostics: Promise<Diagnostic[]> = Promise.resolve([])

    async function requestDiagnostics(version: number) {
      let start = process.hrtime.bigint()

      trace('Waiting for diagnostics')
      trace('- uri:', rewriteUri(uri))

      currentDiagnostics = new Promise<Diagnostic[]>((resolve) => {
        notifications.onPublishedDiagnostics(uri.toString(), (params) => {
          // We recieved diagnostics for different version of this document
          if (params.version !== undefined) {
            if (params.version !== version) return
          }

          let elapsed = process.hrtime.bigint() - start

          trace('Loaded diagnostics')
          trace(`- uri:`, rewriteUri(params.uri))
          trace(`- duration: %dms`, (Number(elapsed) / 1e6).toFixed(3))

          resolve(params.diagnostics)
        })
      })
    }

    async function reopen() {
      if (state === 'opened') throw new Error('Document is already open')
      if (state === 'opening') throw new Error('Document is currently opening')

      let start = process.hrtime.bigint()

      let wasOpened = new Promise<void>((resolve) => {
        notifications.onDocumentReady(uri.toString(), (params) => {
          let elapsed = process.hrtime.bigint() - start
          trace(`Document ready`)
          trace(`- uri:`, rewriteUri(params.uri))
          trace(`- duration: %dms`, (Number(elapsed) / 1e6).toFixed(3))
          resolve()
        })
      })

      trace('Opening document')
      trace(`- uri:`, rewriteUri(uri))

      await requestDiagnostics(version)

      state = 'opening'

      try {
        // Ask the server to open the document
        await conn.sendNotification(DidOpenTextDocumentNotification.type, {
          textDocument: {
            uri: uri.toString(),
            version: version++,
            languageId: desc.lang,
            text: desc.text,
          },
        })

        // Wait for it to respond that it has
        await wasOpened

        // TODO: This works around a race condition where the document reports as ready
        // but the capabilities and design system are not yet available
        await new Promise((r) => setTimeout(r, 100))

        state = 'opened'
      } catch (e) {
        state = 'closed'
        throw e
      }
    }

    async function update(desc: DocumentDescriptor) {
      if (desc.name) throw new Error('Cannot rename or move files')
      if (desc.lang) throw new Error('Cannot change language')

      if (desc.settings) {
        configuration.set(uri.toString(), desc.settings)
      }

      if (desc.text) {
        version += 1
        await requestDiagnostics(version)
        await conn.sendNotification(DidChangeTextDocumentNotification.type, {
          textDocument: { uri: uri.toString(), version },
          contentChanges: [{ text: desc.text }],
        })
      }
    }

    async function close() {
      await conn.sendNotification(DidCloseTextDocumentNotification.type, {
        textDocument: { uri: uri.toString() },
      })

      state = 'closed'
    }

    function hover(pos: Position) {
      return conn.sendRequest(HoverRequest.type, {
        position: pos,
        textDocument: {
          uri: uri.toString(),
        },
      })
    }

    async function completions(pos: Position | Omit<CompletionParams, 'textDocument'>) {
      let params = 'position' in pos ? pos : { position: pos }

      let list = await conn.sendRequest(CompletionRequest.type, {
        ...params,
        textDocument: {
          uri: uri.toString(),
        },
      })

      if (Array.isArray(list)) {
        return {
          isIncomplete: false,
          items: list,
        }
      }

      return list
    }

    function diagnostics() {
      return currentDiagnostics
    }

    async function symbols() {
      let results = await conn.sendRequest(DocumentSymbolRequest.type, {
        textDocument: {
          uri: uri.toString(),
        },
      })

      for (let result of results ?? []) {
        if ('location' in result) {
          result.location.uri = rewriteUri(result.location.uri)!
        }
      }

      return results
    }

    async function links() {
      let results = await conn.sendRequest(DocumentLinkRequest.type, {
        textDocument: {
          uri: uri.toString(),
        },
      })

      for (let result of results ?? []) {
        if (result.target) result.target = rewriteUri(result.target)
      }

      return results
    }

    async function codeLenses() {
      return await conn.sendRequest(CodeLensRequest.type, {
        textDocument: {
          uri: uri.toString(),
        },
      })
    }

    return {
      uri,
      reopen,
      update,
      close,
      hover,
      links,
      symbols,
      completions,
      diagnostics,
      codeLenses,
    }
  }

  async function open(desc: DocumentDescriptor): Promise<ClientDocument> {
    let doc = await createClientDocument(desc)
    await doc.update({ settings: desc.settings })
    await doc.reopen()
    return doc
  }

  async function updateSettings(settings: Settings) {
    configuration.set(folder.uri, settings)
  }

  // TODO: This should not be a notification but instead a request
  // We should "ask" for the project details instead of it giving them to us
  async function project() {
    return projectDetails
  }

  return {
    name: folder.name,
    conn,
    open,
    updateSettings,
    project,
  }
}

interface ClientNotifications {
  onDocumentReady(uri: string, handler: (params: DocumentReady) => void): Disposable
  onPublishedDiagnostics(
    uri: string,
    handler: (params: PublishDiagnosticsParams) => void,
  ): Disposable
  onProjectDetails(uri: string, handler: (params: ProjectDetails) => void): Disposable
}

/**
 * A tiny wrapper that lets us install multiple notification handlers for specific methods
 *
 * The implementation of vscode-jsonrpc only allows for one handler per method, but we want to
 * install multiple handlers for the same method so we deal with that here
 */
async function createDocumentNotifications(conn: ProtocolConnection): Promise<ClientNotifications> {
  let readyHandlers = new DefaultMap<string, (NotificationHandler<any> | null)[]>(() => [])
  conn.onNotification(DocumentReadyNotification.type, (params) => {
    for (let handler of readyHandlers.get(params.uri)) {
      if (!handler) continue
      handler(params)
    }
  })

  let diagnosticsHandlers = new DefaultMap<string, (NotificationHandler<any> | null)[]>(() => [])
  conn.onNotification(PublishDiagnosticsNotification.type, (params) => {
    for (let handler of diagnosticsHandlers.get(params.uri)) {
      if (!handler) continue
      handler(params)
    }
  })

  let projectDetailsHandlers = new DefaultMap<string, (NotificationHandler<any> | null)[]>(() => [])
  conn.onNotification(ProjectDetailsNotification.type, (params) => {
    for (let handler of projectDetailsHandlers.get(params.uri)) {
      if (!handler) continue
      handler(params)
    }
  })

  return {
    onDocumentReady: (uri, handler) => {
      let index = readyHandlers.get(uri).push(handler) - 1
      return {
        dispose() {
          readyHandlers.get(uri)[index] = null
        },
      }
    },

    onPublishedDiagnostics: (uri, handler) => {
      let index = diagnosticsHandlers.get(uri).push(handler) - 1
      return {
        dispose() {
          diagnosticsHandlers.get(uri)[index] = null
        },
      }
    },

    onProjectDetails: (uri, handler) => {
      let index = projectDetailsHandlers.get(uri).push(handler) - 1
      return {
        dispose() {
          projectDetailsHandlers.get(uri)[index] = null
        },
      }
    },
  }
}
