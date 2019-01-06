/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
import {
  workspace as Workspace,
  window as Window,
  ExtensionContext,
  TextDocument,
  TextEditor,
  OutputChannel,
  WorkspaceFolder,
  Uri,
  commands,
  Selection,
  Position,
  Range,
  TextEditorRevealType
} from 'vscode'

import {
  LanguageClient,
  LanguageClientOptions,
  TransportKind
} from 'vscode-languageclient'

import { createTreeView } from './treeView'

const CONFIG_GLOB =
  '**/{tailwind,tailwind.config,tailwind-config,.tailwindrc}.js'
let LANGUAGES: string[] = ['html']

let defaultClient: LanguageClient
let clients: Map<string, LanguageClient> = new Map()

let _sortedWorkspaceFolders: string[] | undefined
function sortedWorkspaceFolders(): string[] {
  if (_sortedWorkspaceFolders === void 0) {
    _sortedWorkspaceFolders = Workspace.workspaceFolders
      ? Workspace.workspaceFolders
          .map(folder => {
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

export async function activate(context: ExtensionContext) {
  // let module = context.asAbsolutePath(path.join('server', 'out', 'server.js'))
  let module = '/Users/brad/Code/tailwindcss-language-server/dist/index.js'
  let outputChannel: OutputChannel = Window.createOutputChannel(
    'lsp-multi-server-example'
  )

  async function didOpenTextDocument(document: TextDocument): Promise<void> {
    // if (
    //   document.uri.scheme !== 'file' ||
    //   LANGUAGES.indexOf(document.languageId) === -1
    // ) {
    //   return
    // }

    let uri = document.uri
    let folder = Workspace.getWorkspaceFolder(uri)
    // Files outside a folder can't be handled. This might depend on the language.
    // Single file languages like JSON might handle files outside the workspace folders.
    if (!folder) {
      return
    }

    // If we have nested workspace folders we only start a server on the outer most workspace folder.
    folder = getOuterMostWorkspaceFolder(folder)

    if (!clients.has(folder.uri.toString())) {
      // placeholder
      clients.set(folder.uri.toString(), null)

      let files = await Workspace.findFiles(
        CONFIG_GLOB,
        '**/node_modules/**',
        1
      )
      if (!files.length) return

      let debugOptions = {
        execArgv: ['--nolazy', `--inspect=${6011 + clients.size}`]
      }
      let serverOptions = {
        run: { module, transport: TransportKind.ipc },
        debug: { module, transport: TransportKind.ipc, options: debugOptions }
      }
      let clientOptions: LanguageClientOptions = {
        documentSelector: LANGUAGES.map(language => ({
          scheme: 'file',
          language,
          pattern: `${folder.uri.fsPath}/**/*`
        })),
        diagnosticCollectionName: 'lsp-multi-server-example',
        workspaceFolder: folder,
        outputChannel: outputChannel
      }
      let client = new LanguageClient(
        'lsp-multi-server-example',
        'LSP Multi Server Example',
        serverOptions,
        clientOptions
      )

      client.onReady().then(() => {
        client.onNotification('tailwindcss/foundConfig', configPath => {
          let refresh = createTreeView(configPath)
        })
        client.onNotification(
          'tailwindcss/foundDefinition',
          (configPath, pos) => {
            Workspace.openTextDocument(configPath).then((doc: TextDocument) => {
              Window.showTextDocument(doc).then((editor: TextEditor) => {
                let start = new Position(pos.start.line, pos.start.character)
                let end = new Position(pos.end.line, pos.end.character)
                editor.revealRange(
                  new Range(start, end),
                  TextEditorRevealType.InCenter
                )
                editor.selection = new Selection(start, end)
              })
            })
          }
        )
        commands.registerCommand('tailwindcss.goToDefinition', key => {
          client.sendNotification('tailwindcss/findDefinition', [key])
        })
      })

      // client.onReady().then(() => {
      //   client.onNotification('tailwind/loaded', () => {
      //     console.log('loaded')
      //   })
      // })
      client.start()
      clients.set(folder.uri.toString(), client)
    }
  }

  Workspace.onDidOpenTextDocument(didOpenTextDocument)
  Workspace.textDocuments.forEach(didOpenTextDocument)
  Workspace.onDidChangeWorkspaceFolders(event => {
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
    if (client) {
      promises.push(client.stop())
    }
  }
  return Promise.all(promises).then(() => undefined)
}
