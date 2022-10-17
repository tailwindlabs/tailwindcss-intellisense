/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
import * as path from 'path'
import {
  workspace as Workspace,
  window as Window,
  languages as Languages,
  ExtensionContext,
  TextDocument,
  OutputChannel,
  WorkspaceFolder,
  Uri,
  commands,
  SymbolInformation,
  Position,
  Range,
  TextEditorDecorationType,
  RelativePattern,
  ConfigurationScope,
  WorkspaceConfiguration,
  CompletionItem,
  CompletionItemKind,
  CompletionList,
  ProviderResult,
  SnippetString,
  TextEdit,
} from 'vscode'
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind,
  State as LanguageClientState,
  RevealOutputChannelOn,
  Disposable,
} from 'vscode-languageclient/node'
import { languages as defaultLanguages } from 'tailwindcss-language-service/src/util/languages'
import isObject from 'tailwindcss-language-service/src/util/isObject'
import { dedupe, equal } from 'tailwindcss-language-service/src/util/array'
import namedColors from 'color-name'
import minimatch from 'minimatch'

const colorNames = Object.keys(namedColors)

const CLIENT_ID = 'tailwindcss-intellisense'
const CLIENT_NAME = 'Tailwind CSS IntelliSense'

const CONFIG_FILE_GLOB = '{tailwind,tailwind.config}.{js,cjs}'

let clients: Map<string, LanguageClient> = new Map()
let languages: Map<string, string[]> = new Map()
let searchedFolders: Set<string> = new Set()

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
  const langs = Workspace.getConfiguration('tailwindCSS', folder).includeLanguages
  return isObject(langs) ? langs : {}
}

function getGlobalExcludePatterns(scope: ConfigurationScope): string[] {
  return Object.entries(Workspace.getConfiguration('files', scope).get('exclude'))
    .filter(([, value]) => value === true)
    .map(([key]) => key)
    .filter(Boolean)
}

function getExcludePatterns(scope: ConfigurationScope): string[] {
  return [
    ...getGlobalExcludePatterns(scope),
    ...(<string[]>Workspace.getConfiguration('tailwindCSS', scope).get('files.exclude')).filter(
      Boolean
    ),
  ]
}

function isExcluded(file: string, folder: WorkspaceFolder): boolean {
  let exclude = getExcludePatterns(folder)

  for (let pattern of exclude) {
    if (minimatch(file, path.join(folder.uri.fsPath, pattern))) {
      return true
    }
  }

  return false
}

function mergeExcludes(settings: WorkspaceConfiguration, scope: ConfigurationScope): any {
  return {
    ...settings,
    files: {
      ...settings.files,
      exclude: getExcludePatterns(scope),
    },
  }
}

export async function activate(context: ExtensionContext) {
  let module = context.asAbsolutePath(path.join('dist', 'server.js'))
  let prod = path.join('dist', 'tailwindServer.js')

  try {
    await Workspace.fs.stat(Uri.joinPath(context.extensionUri, prod))
    module = context.asAbsolutePath(prod)
  } catch (_) {}

  let outputChannel: OutputChannel

  context.subscriptions.push(
    commands.registerCommand('tailwindCSS.showOutput', () => {
      if (outputChannel) {
        outputChannel.show()
      }
    })
  )

  let watcher = Workspace.createFileSystemWatcher(`**/${CONFIG_FILE_GLOB}`, false, true, true)

  watcher.onDidCreate((uri) => {
    let folder = Workspace.getWorkspaceFolder(uri)
    if (!folder) {
      return
    }
    if (!isExcluded(uri.fsPath, folder)) {
      folder = getOuterMostWorkspaceFolder(folder)
      bootWorkspaceClient(folder)
    }
  })

  context.subscriptions.push(watcher)

  // TODO: check if the actual language MAPPING changed
  // not just the language IDs
  // e.g. "plaintext" already exists but you change it from "html" to "css"
  context.subscriptions.push(
    Workspace.onDidChangeConfiguration((event) => {
      ;[...clients].forEach(([key, client]) => {
        const folder = Workspace.getWorkspaceFolder(Uri.parse(key))
        let reboot = false

        if (event.affectsConfiguration('tailwindCSS.includeLanguages', folder)) {
          const userLanguages = getUserLanguages(folder)
          if (userLanguages) {
            const userLanguageIds = Object.keys(userLanguages)
            const newLanguages = dedupe([...defaultLanguages, ...userLanguageIds])
            if (!equal(newLanguages, languages.get(folder.uri.toString()))) {
              languages.set(folder.uri.toString(), newLanguages)
              reboot = true
            }
          }
        }

        if (event.affectsConfiguration('tailwindCSS.experimental.configFile', folder)) {
          reboot = true
        }

        if (reboot && client) {
          clients.delete(folder.uri.toString())
          client.stop()
          bootWorkspaceClient(folder)
        }
      })
    })
  )

  let cssServerBooted = false
  async function bootCssServer() {
    if (cssServerBooted) return
    cssServerBooted = true

    let module = context.asAbsolutePath(path.join('dist', 'cssServer.js'))
    let prod = path.join('dist', 'tailwindModeServer.js')

    try {
      await Workspace.fs.stat(Uri.joinPath(context.extensionUri, prod))
      module = context.asAbsolutePath(prod)
    } catch (_) {}

    let client = new LanguageClient(
      'tailwindcss-intellisense-css',
      'Tailwind CSS',
      {
        run: {
          module,
          transport: TransportKind.ipc,
        },
        debug: {
          module,
          transport: TransportKind.ipc,
          options: {
            execArgv: ['--nolazy', '--inspect=6051'],
          },
        },
      },
      {
        documentSelector: [{ language: 'tailwindcss' }],
        outputChannelName: 'Tailwind CSS Language Mode',
        synchronize: { configurationSection: ['css'] },
        middleware: {
          provideCompletionItem(document, position, context, token, next) {
            function updateRanges(item: CompletionItem) {
              const range = item.range
              if (
                range instanceof Range &&
                range.end.isAfter(position) &&
                range.start.isBeforeOrEqual(position)
              ) {
                item.range = { inserting: new Range(range.start, position), replacing: range }
              }
            }
            function updateLabel(item: CompletionItem) {
              if (item.kind === CompletionItemKind.Color) {
                item.label = {
                  label: item.label as string,
                  description: item.documentation as string,
                }
              }
            }
            function updateProposals(
              r: CompletionItem[] | CompletionList | null | undefined
            ): CompletionItem[] | CompletionList | null | undefined {
              if (r) {
                ;(Array.isArray(r) ? r : r.items).forEach(updateRanges)
                ;(Array.isArray(r) ? r : r.items).forEach(updateLabel)
              }
              return r
            }
            const isThenable = <T>(obj: ProviderResult<T>): obj is Thenable<T> =>
              obj && (<any>obj)['then']

            const r = next(document, position, context, token)
            if (isThenable<CompletionItem[] | CompletionList | null | undefined>(r)) {
              return r.then(updateProposals)
            }
            return updateProposals(r)
          },
        },
      }
    )

    await client.start()
    context.subscriptions.push(initCompletionProvider())

    function initCompletionProvider(): Disposable {
      const regionCompletionRegExpr = /^(\s*)(\/(\*\s*(#\w*)?)?)?$/

      return Languages.registerCompletionItemProvider(['tailwindcss'], {
        provideCompletionItems(doc: TextDocument, pos: Position) {
          let lineUntilPos = doc.getText(new Range(new Position(pos.line, 0), pos))
          let match = lineUntilPos.match(regionCompletionRegExpr)
          if (match) {
            let range = new Range(new Position(pos.line, match[1].length), pos)
            let beginProposal = new CompletionItem('#region', CompletionItemKind.Snippet)
            beginProposal.range = range
            TextEdit.replace(range, '/* #region */')
            beginProposal.insertText = new SnippetString('/* #region $1*/')
            beginProposal.documentation = 'Folding Region Start'
            beginProposal.filterText = match[2]
            beginProposal.sortText = 'za'
            let endProposal = new CompletionItem('#endregion', CompletionItemKind.Snippet)
            endProposal.range = range
            endProposal.insertText = '/* #endregion */'
            endProposal.documentation = 'Folding Region End'
            endProposal.sortText = 'zb'
            endProposal.filterText = match[2]
            return [beginProposal, endProposal]
          }
          return null
        },
      })
    }
  }

  function bootWorkspaceClient(folder: WorkspaceFolder) {
    if (clients.has(folder.uri.toString())) {
      return
    }

    let colorDecorationType: TextEditorDecorationType
    function clearColors(): void {
      if (colorDecorationType) {
        colorDecorationType.dispose()
        colorDecorationType = undefined
      }
    }
    context.subscriptions.push({
      dispose() {
        if (colorDecorationType) {
          colorDecorationType.dispose()
        }
      },
    })

    // placeholder so we don't boot another server before this one is ready
    clients.set(folder.uri.toString(), null)

    if (!languages.has(folder.uri.toString())) {
      languages.set(
        folder.uri.toString(),
        dedupe([...defaultLanguages, ...Object.keys(getUserLanguages(folder))])
      )
    }

    if (!outputChannel) {
      outputChannel = Window.createOutputChannel(CLIENT_NAME)
      context.subscriptions.push(outputChannel)
      commands.executeCommand('setContext', 'tailwindCSS.hasOutputChannel', true)
    }

    let configuration = {
      editor: Workspace.getConfiguration('editor', folder),
      tailwindCSS: mergeExcludes(Workspace.getConfiguration('tailwindCSS', folder), folder),
    }

    let inspectPort = configuration.tailwindCSS.get('inspectPort')

    let serverOptions: ServerOptions = {
      run: {
        module,
        transport: TransportKind.ipc,
        options: { execArgv: inspectPort === null ? [] : [`--inspect=${inspectPort}`] },
      },
      debug: {
        module,
        transport: TransportKind.ipc,
        options: {
          execArgv: ['--nolazy', `--inspect=${6011 + clients.size}`],
        },
      },
    }

    let clientOptions: LanguageClientOptions = {
      documentSelector: languages.get(folder.uri.toString()).map((language) => ({
        scheme: 'file',
        language,
        pattern: `${folder.uri.fsPath.replace(/[\[\]\{\}]/g, '?')}/**/*`,
      })),
      diagnosticCollectionName: CLIENT_ID,
      workspaceFolder: folder,
      outputChannel: outputChannel,
      revealOutputChannelOn: RevealOutputChannelOn.Never,
      middleware: {
        async resolveCompletionItem(item, token, next) {
          let result = await next(item, token)
          let selections = Window.activeTextEditor.selections
          if (
            result['data'] === 'variant' &&
            selections.length > 1 &&
            result.additionalTextEdits?.length > 0
          ) {
            let length =
              selections[0].start.character - result.additionalTextEdits[0].range.start.character
            let prefixLength =
              result.additionalTextEdits[0].range.end.character -
              result.additionalTextEdits[0].range.start.character

            let ranges = selections.map((selection) => {
              return new Range(
                new Position(selection.start.line, selection.start.character - length),
                new Position(
                  selection.start.line,
                  selection.start.character - length + prefixLength
                )
              )
            })
            if (
              ranges
                .map((range) => Window.activeTextEditor.document.getText(range))
                .every((text, _index, arr) => arr.indexOf(text) === 0)
            ) {
              // all the same
              result.additionalTextEdits = ranges.map((range) => {
                return { range, newText: result.additionalTextEdits[0].newText }
              })
            } else {
              result.insertText =
                typeof result.label === 'string' ? result.label : result.label.label
              result.additionalTextEdits = []
            }
          }
          return result
        },
        async provideDocumentColors(document, token, next) {
          let colors = await next(document, token)
          let editableColors = colors.filter((color) => {
            let text =
              Workspace.textDocuments.find((doc) => doc === document)?.getText(color.range) ?? ''
            return new RegExp(
              `-\\[(${colorNames.join('|')}|((?:#|rgba?\\(|hsla?\\())[^\\]]+)\\]$`
            ).test(text)
          })
          let nonEditableColors = colors.filter((color) => !editableColors.includes(color))

          if (!colorDecorationType) {
            colorDecorationType = Window.createTextEditorDecorationType({
              before: {
                width: '0.8em',
                height: '0.8em',
                contentText: ' ',
                border: '0.1em solid',
                margin: '0.1em 0.2em 0',
              },
              dark: {
                before: {
                  borderColor: '#eeeeee',
                },
              },
              light: {
                before: {
                  borderColor: '#000000',
                },
              },
            })
          }

          Window.visibleTextEditors
            .find((editor) => editor.document === document)
            ?.setDecorations(
              colorDecorationType,
              nonEditableColors.map(({ range, color }) => ({
                range,
                renderOptions: {
                  before: {
                    backgroundColor: `rgba(${color.red * 255}, ${color.green * 255}, ${
                      color.blue * 255
                    }, ${color.alpha})`,
                  },
                },
              }))
            )

          return editableColors
        },
        workspace: {
          configuration: (params) => {
            return params.items.map(({ section, scopeUri }) => {
              let scope: ConfigurationScope = folder
              if (scopeUri) {
                let doc = Workspace.textDocuments.find((doc) => doc.uri.toString() === scopeUri)
                if (doc) {
                  scope = {
                    languageId: doc.languageId,
                  }
                }
              }
              let settings = Workspace.getConfiguration(section, scope)

              if (section === 'tailwindCSS') {
                return mergeExcludes(settings, scope)
              }

              return settings
            })
          },
        },
      },
      initializationOptions: {
        userLanguages: getUserLanguages(folder),
      },
      synchronize: {
        configurationSection: ['files', 'editor', 'tailwindCSS'],
      },
    }

    let client = new LanguageClient(CLIENT_ID, CLIENT_NAME, serverOptions, clientOptions)

    client.onNotification('@/tailwindCSS/error', async ({ message }) => {
      let action = await Window.showErrorMessage(message, 'Go to output')
      if (action === 'Go to output') {
        commands.executeCommand('tailwindCSS.showOutput')
      }
    })

    client.onNotification('@/tailwindCSS/clearColors', () => clearColors())

    client.onRequest('@/tailwindCSS/getDocumentSymbols', async ({ uri }) => {
      return commands.executeCommand<SymbolInformation[]>(
        'vscode.executeDocumentSymbolProvider',
        Uri.parse(uri)
      )
    })

    client.onDidChangeState(({ newState }) => {
      if (newState === LanguageClientState.Stopped) {
        clearColors()
      }
    })

    client.start()
    clients.set(folder.uri.toString(), client)
  }

  async function didOpenTextDocument(document: TextDocument): Promise<void> {
    if (document.languageId === 'tailwindcss') {
      bootCssServer()
    }

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

    if (searchedFolders.has(folder.uri.toString())) return

    searchedFolders.add(folder.uri.toString())

    let [configFile] = await Workspace.findFiles(
      new RelativePattern(folder, `**/${CONFIG_FILE_GLOB}`),
      `{${getExcludePatterns(folder).join(',')}}`,
      1
    )

    if (!configFile) {
      return
    }

    bootWorkspaceClient(folder)
  }

  context.subscriptions.push(Workspace.onDidOpenTextDocument(didOpenTextDocument))
  Workspace.textDocuments.forEach(didOpenTextDocument)
  context.subscriptions.push(
    Workspace.onDidChangeWorkspaceFolders((event) => {
      _sortedWorkspaceFolders = undefined

      for (let folder of event.removed) {
        let client = clients.get(folder.uri.toString())
        if (client) {
          searchedFolders.delete(folder.uri.toString())
          clients.delete(folder.uri.toString())
          client.stop()
        }
      }
    })
  )
}

export function deactivate(): Thenable<void> {
  let promises: Thenable<void>[] = []
  for (let client of clients.values()) {
    promises.push(client.stop())
  }
  return Promise.all(promises).then(() => undefined)
}
