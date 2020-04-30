/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
import * as path from 'path'
import {
  workspace as Workspace,
  window as Window,
  ExtensionContext,
  TextDocument,
  OutputChannel,
  WorkspaceFolder,
  Uri,
} from 'vscode'
import {
  LanguageClient,
  LanguageClientOptions,
  TransportKind,
} from 'vscode-languageclient'
import { registerConfigErrorHandler } from './lib/registerConfigErrorHandler'
import { DEFAULT_LANGUAGES } from './lib/languages'
import { arraysEqual } from './util/arraysEqual'
import { unique } from './util/unique'
import { isObject } from './util/isObject'

let defaultClient: LanguageClient
let clients: Map<string, LanguageClient> = new Map()
let languages: Map<string, string[]> = new Map()
let globalLanguages: string[]

let _sortedWorkspaceFolders: string[] | undefined
function sortedWorkspaceFolders(): string[] {
  if (_sortedWorkspaceFolders === void 0) {
    _sortedWorkspaceFolders = Workspace.workspaceFolders
      ? Workspace.workspaceFolders
          .map((folder) => {
            let result = folder.uri.toString()
            if (result.charAt(result.length - 1) !== '/') {
              result = result + '/'
            }
            return result
          })
          .sort((a, b) => {
            return a.length - b.length
          })
      : []
  }
  return _sortedWorkspaceFolders
}
Workspace.onDidChangeWorkspaceFolders(
  () => (_sortedWorkspaceFolders = undefined)
)

function getOuterMostWorkspaceFolder(folder: WorkspaceFolder): WorkspaceFolder {
  let sorted = sortedWorkspaceFolders()
  for (let element of sorted) {
    let uri = folder.uri.toString()
    if (uri.charAt(uri.length - 1) !== '/') {
      uri = uri + '/'
    }
    if (uri.startsWith(element)) {
      return Workspace.getWorkspaceFolder(Uri.parse(element))!
    }
  }
  return folder
}

function getUserLanguages(folder?: WorkspaceFolder): Record<string, string> {
  const langs = Workspace.getConfiguration('tailwindCSS', folder)
    .includeLanguages
  return isObject(langs) ? langs : {}
}

export function activate(context: ExtensionContext) {
  let module = context.asAbsolutePath(
    path.join('dist', 'src', 'server', 'index.js')
  )
  let outputChannel: OutputChannel = Window.createOutputChannel(
    'lsp-multi-server-example'
  )

  globalLanguages = unique([
    ...DEFAULT_LANGUAGES,
    ...Object.keys(getUserLanguages()),
  ])

  // TODO: check if the actual language MAPPING changed
  // not just the language IDs
  // e.g. "plaintext" already exists but you change it from "html" to "css"
  Workspace.onDidChangeConfiguration((event) => {
    if (event.affectsConfiguration('tailwindCSS')) {
      const newGlobalLanguages = unique([
        ...DEFAULT_LANGUAGES,
        ...Object.keys(getUserLanguages()),
      ])

      if (!arraysEqual(newGlobalLanguages, globalLanguages)) {
        globalLanguages = newGlobalLanguages

        if (defaultClient) {
          defaultClient.stop()
          defaultClient = undefined
          bootDefaultClient()
        }
      }
    }

    clients.forEach((client, key) => {
      const folder = Workspace.getWorkspaceFolder(Uri.parse(key))

      if (event.affectsConfiguration('tailwindCSS', folder)) {
        const userLanguages = getUserLanguages(folder)
        if (userLanguages) {
          const userLanguageIds = Object.keys(userLanguages)
          const newLanguages = unique([
            ...DEFAULT_LANGUAGES,
            ...userLanguageIds,
          ])
          if (
            !arraysEqual(newLanguages, languages.get(folder.uri.toString()))
          ) {
            languages.set(folder.uri.toString(), newLanguages)

            if (client) {
              clients.delete(folder.uri.toString())
              client.stop()
              boot(folder)
            }
          }
        }
      }
    })
  })

  function bootDefaultClient() {
    if (defaultClient) return

    defaultClient = new LanguageClient(
      'lsp-multi-server-example',
      'LSP Multi Server Example',
      {
        run: { module, transport: TransportKind.ipc },
        debug: {
          module,
          transport: TransportKind.ipc,
          options: { execArgv: ['--nolazy', '--inspect=6010'] },
        },
      },
      {
        documentSelector: globalLanguages.map((language) => ({
          scheme: 'untitled',
          language,
        })),
        diagnosticCollectionName: 'lsp-multi-server-example',
        outputChannel,
        initializationOptions: {
          userLanguages: getUserLanguages(),
        },
      }
    )
    defaultClient.start()
  }

  function boot(folder: WorkspaceFolder) {
    if (clients.has(folder.uri.toString())) {
      return
    }

    let debugOptions = {
      execArgv: ['--nolazy', `--inspect=${6011 + clients.size}`],
    }
    let serverOptions = {
      run: { module, transport: TransportKind.ipc },
      debug: {
        module,
        transport: TransportKind.ipc,
        options: debugOptions,
      },
    }
    let clientOptions: LanguageClientOptions = {
      documentSelector: languages
        .get(folder.uri.toString())
        .map((language) => ({
          scheme: 'file',
          language,
          pattern: `${folder.uri.fsPath}/**/*`,
        })),
      diagnosticCollectionName: 'lsp-multi-server-example',
      workspaceFolder: folder,
      outputChannel: outputChannel,
      middleware: {},
      initializationOptions: {
        userLanguages: getUserLanguages(folder),
      },
    }
    let client = new LanguageClient(
      'lsp-multi-server-example',
      'LSP Multi Server Example',
      serverOptions,
      clientOptions
    )

    client.onReady().then(() => {
      registerConfigErrorHandler(client)
    })

    client.start()
    clients.set(folder.uri.toString(), client)
  }

  function didOpenTextDocument(document: TextDocument): void {
    // We are only interested in language mode text
    if (
      document.uri.scheme !== 'file' &&
      document.uri.scheme !== 'untitled'
    ) {
      return
    }

    let uri = document.uri
    // Untitled files go to a default client.
    if (uri.scheme === 'untitled') {
      if (globalLanguages.indexOf(document.languageId) === -1) {
        return
      }
      bootDefaultClient()
      return
    }

    let folder = Workspace.getWorkspaceFolder(uri)
    // Files outside a folder can't be handled. This might depend on the language.
    // Single file languages like JSON might handle files outside the workspace folders.
    if (!folder) {
      return
    }
    // If we have nested workspace folders we only start a server on the outer most workspace folder.
    folder = getOuterMostWorkspaceFolder(folder)

    languages.set(
      folder.uri.toString(),
      unique([...DEFAULT_LANGUAGES, ...Object.keys(getUserLanguages())])
    )

    boot(folder)
  }

  Workspace.onDidOpenTextDocument(didOpenTextDocument)
  Workspace.textDocuments.forEach(didOpenTextDocument)
  Workspace.onDidChangeWorkspaceFolders((event) => {
    for (let folder of event.removed) {
      let client = clients.get(folder.uri.toString())
      if (client) {
        clients.delete(folder.uri.toString())
        client.stop()
      }
    }
  })
}

export function deactivate(): Thenable<void> {
  let promises: Thenable<void>[] = []
  if (defaultClient) {
    promises.push(defaultClient.stop())
  }
  for (let client of clients.values()) {
    promises.push(client.stop())
  }
  return Promise.all(promises).then(() => undefined)
}
