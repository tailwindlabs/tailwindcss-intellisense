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
  ConfigurationScope,
} from 'vscode'
import {
  LanguageClient,
  LanguageClientOptions,
  TransportKind,
} from 'vscode-languageclient'
import { registerConfigErrorHandler } from './lib/registerConfigErrorHandler'
import { DEFAULT_LANGUAGES } from './lib/languages'
import isObject from './util/isObject'
import { dedupe, equal } from './util/array'
import { createEmitter } from './lib/emitter'
import { onMessage } from './lsp/notifications'
import { registerColorDecorator } from './lib/registerColorDecorator'

const CLIENT_ID = 'tailwindcss-intellisense'
const CLIENT_NAME = 'Tailwind CSS IntelliSense'

let clients: Map<string, LanguageClient> = new Map()
let languages: Map<string, string[]> = new Map()

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
  let module = context.asAbsolutePath(path.join('dist', 'server', 'index.js'))
  let outputChannel: OutputChannel = Window.createOutputChannel(CLIENT_ID)

  // TODO: check if the actual language MAPPING changed
  // not just the language IDs
  // e.g. "plaintext" already exists but you change it from "html" to "css"
  Workspace.onDidChangeConfiguration((event) => {
    clients.forEach((client, key) => {
      const folder = Workspace.getWorkspaceFolder(Uri.parse(key))

      if (event.affectsConfiguration('tailwindCSS', folder)) {
        const userLanguages = getUserLanguages(folder)
        if (userLanguages) {
          const userLanguageIds = Object.keys(userLanguages)
          const newLanguages = dedupe([
            ...DEFAULT_LANGUAGES,
            ...userLanguageIds,
          ])
          if (!equal(newLanguages, languages.get(folder.uri.toString()))) {
            languages.set(folder.uri.toString(), newLanguages)

            if (client) {
              clients.delete(folder.uri.toString())
              client.stop()
              bootWorkspaceClient(folder)
            }
          }
        }
      }
    })
  })

  function bootWorkspaceClient(folder: WorkspaceFolder) {
    if (clients.has(folder.uri.toString())) {
      return
    }

    // placeholder so we don't boot another server before this one is ready
    clients.set(folder.uri.toString(), null)

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
      diagnosticCollectionName: CLIENT_ID,
      workspaceFolder: folder,
      outputChannel: outputChannel,
      middleware: {},
      initializationOptions: {
        userLanguages: getUserLanguages(folder),
      },
    }
    let client = new LanguageClient(
      CLIENT_ID,
      CLIENT_NAME,
      serverOptions,
      clientOptions
    )

    client.onReady().then(() => {
      let emitter = createEmitter(client)
      registerConfigErrorHandler(emitter)
      registerColorDecorator(client, context, emitter)
      onMessage(client, 'getConfiguration', async (scope) => {
        return Workspace.getConfiguration('tailwindCSS', scope)
      })
    })

    client.start()
    clients.set(folder.uri.toString(), client)
  }

  function didOpenTextDocument(document: TextDocument): void {
    // We are only interested in language mode text
    if (document.uri.scheme !== 'file') {
      return
    }

    let uri = document.uri
    let folder = Workspace.getWorkspaceFolder(uri)
    // Files outside a folder can't be handled. This might depend on the language.
    // Single file languages like JSON might handle files outside the workspace folders.
    if (!folder) {
      return
    }
    // If we have nested workspace folders we only start a server on the outer most workspace folder.
    folder = getOuterMostWorkspaceFolder(folder)

    if (!languages.has(folder.uri.toString())) {
      languages.set(
        folder.uri.toString(),
        dedupe([...DEFAULT_LANGUAGES, ...Object.keys(getUserLanguages())])
      )
    }

    bootWorkspaceClient(folder)
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
  for (let client of clients.values()) {
    promises.push(client.stop())
  }
  return Promise.all(promises).then(() => undefined)
}
