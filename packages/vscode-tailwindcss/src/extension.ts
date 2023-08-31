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
  TextEditorSelectionChangeKind,
  Selection,
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
import * as semver from 'tailwindcss-language-service/src/util/semver'
import isObject from 'tailwindcss-language-service/src/util/isObject'
import { dedupe, equal } from 'tailwindcss-language-service/src/util/array'
import namedColors from 'color-name'
import minimatch from 'minimatch'
import { CONFIG_GLOB, CSS_GLOB } from 'tailwindcss-language-server/src/lib/constants'
import braces from 'braces'
import normalizePath from 'normalize-path'

const colorNames = Object.keys(namedColors)

const CLIENT_ID = 'tailwindcss-intellisense'
const CLIENT_NAME = 'Tailwind CSS IntelliSense'

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

async function fileContainsAtConfig(uri: Uri) {
  let contents = (await Workspace.fs.readFile(uri)).toString()
  return /@config\s*['"]/.test(contents)
}

function selectionsAreEqual(
  aSelections: readonly Selection[],
  bSelections: readonly Selection[]
): boolean {
  if (aSelections.length !== bSelections.length) {
    return false
  }
  for (let i = 0; i < aSelections.length; i++) {
    if (!aSelections[i].isEqual(bSelections[i])) {
      return false
    }
  }
  return true
}

async function getActiveTextEditorProject(): Promise<{ version: string } | null> {
  if (clients.size === 0) {
    return null
  }
  let editor = Window.activeTextEditor
  if (!editor) {
    return null
  }
  let uri = editor.document.uri
  let folder = Workspace.getWorkspaceFolder(uri)
  if (!folder) {
    return null
  }
  let client = clients.get(folder.uri.toString())
  if (!client) {
    return null
  }
  if (isExcluded(uri.fsPath, folder)) {
    return null
  }
  try {
    let project = await client.sendRequest<{ version: string } | null>('@/tailwindCSS/getProject', {
      uri: uri.toString(),
    })
    return project
  } catch {
    return null
  }
}

async function activeTextEditorSupportsClassSorting(): Promise<boolean> {
  let project = await getActiveTextEditorProject()
  if (!project) {
    return false
  }
  return semver.gte(project.version, '3.0.0')
}

async function updateActiveTextEditorContext(): Promise<void> {
  commands.executeCommand(
    'setContext',
    'tailwindCSS.activeTextEditorSupportsClassSorting',
    await activeTextEditorSupportsClassSorting()
  )
}

function resetActiveTextEditorContext(): void {
  commands.executeCommand('setContext', 'tailwindCSS.activeTextEditorSupportsClassSorting', false)
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

  async function sortSelection(): Promise<void> {
    let { document, selections } = Window.activeTextEditor

    if (selections.length === 0) {
      return
    }

    let initialSelections = selections
    let folder = Workspace.getWorkspaceFolder(document.uri)

    if (clients.size === 0 || !folder || isExcluded(document.uri.fsPath, folder)) {
      throw Error(`No active Tailwind project found for file ${document.uri.fsPath}`)
    }

    let client = clients.get(folder.uri.toString())
    if (!client) {
      throw Error(`No active Tailwind project found for file ${document.uri.fsPath}`)
    }

    let result = await client.sendRequest<{ error: string } | { classLists: string[] }>(
      '@/tailwindCSS/sortSelection',
      {
        uri: document.uri.toString(),
        classLists: selections.map((selection) => document.getText(selection)),
      }
    )

    if (
      Window.activeTextEditor.document !== document ||
      !selectionsAreEqual(initialSelections, Window.activeTextEditor.selections)
    ) {
      return
    }

    if ('error' in result) {
      throw Error(
        {
          'no-project': `No active Tailwind project found for file ${document.uri.fsPath}`,
        }[result.error] ?? 'An unknown error occurred.'
      )
    }

    let sortedClassLists = result.classLists
    Window.activeTextEditor.edit((builder) => {
      for (let i = 0; i < selections.length; i++) {
        builder.replace(selections[i], sortedClassLists[i])
      }
    })
  }

  context.subscriptions.push(
    commands.registerCommand('tailwindCSS.sortSelection', async () => {
      try {
        await sortSelection()
      } catch (error) {
        Window.showWarningMessage(`Couldn’t sort Tailwind classes: ${error.message}`)
      }
    })
  )

  context.subscriptions.push(
    Window.onDidChangeActiveTextEditor(async () => {
      await updateActiveTextEditorContext()
    })
  )

  // context.subscriptions.push(
  //   commands.registerCommand(
  //     'tailwindCSS.onInsertArbitraryVariantSnippet',
  //     (
  //       variantName: string,
  //       range: {
  //         start: { line: number; character: number }
  //         end: { line: number; character: number }
  //       }
  //     ) => {
  //       let listener = Window.onDidChangeTextEditorSelection((event) => {
  //         if (event.selections.length !== 1) {
  //           listener.dispose()
  //           return
  //         }

  //         let document = event.textEditor.document
  //         let selection = event.selections[0]

  //         let line = document.lineAt(range.start.line)
  //         let lineRangeFromCompletion = new Range(
  //           range.start.line,
  //           range.start.character,
  //           line.range.end.line,
  //           line.range.end.character
  //         )
  //         let lineText = document.getText(lineRangeFromCompletion)
  //         let match = lineText.match(/^(\S+)]:/)

  //         if (!match) {
  //           listener.dispose()
  //           return
  //         }

  //         let arbitraryValueRange = new Range(
  //           lineRangeFromCompletion.start.translate(0, variantName.length + 2),
  //           lineRangeFromCompletion.start.translate(0, match[1].length)
  //         )

  //         if (!arbitraryValueRange.contains(selection)) {
  //           listener.dispose()
  //         }

  //         if (
  //           event.kind === TextEditorSelectionChangeKind.Command &&
  //           selection.isEmpty &&
  //           selection.start.isEqual(arbitraryValueRange.end.translate(0, 2))
  //         ) {
  //           commands.executeCommand('editor.action.triggerSuggest')
  //         }
  //       })
  //       context.subscriptions.push(listener)
  //     }
  //   )
  // )

  let configWatcher = Workspace.createFileSystemWatcher(`**/${CONFIG_GLOB}`, false, true, true)

  configWatcher.onDidCreate((uri) => {
    let folder = Workspace.getWorkspaceFolder(uri)
    if (!folder || isExcluded(uri.fsPath, folder)) {
      return
    }
    bootWorkspaceClient(folder)
  })

  context.subscriptions.push(configWatcher)

  let cssWatcher = Workspace.createFileSystemWatcher(`**/${CSS_GLOB}`, false, false, true)

  async function bootClientIfCssFileContainsAtConfig(uri: Uri) {
    let folder = Workspace.getWorkspaceFolder(uri)
    if (!folder || isExcluded(uri.fsPath, folder)) {
      return
    }
    if (await fileContainsAtConfig(uri)) {
      bootWorkspaceClient(folder)
    }
  }

  cssWatcher.onDidCreate(bootClientIfCssFileContainsAtConfig)
  cssWatcher.onDidChange(bootClientIfCssFileContainsAtConfig)

  context.subscriptions.push(cssWatcher)

  // TODO: check if the actual language MAPPING changed
  // not just the language IDs
  // e.g. "plaintext" already exists but you change it from "html" to "css"
  context.subscriptions.push(
    Workspace.onDidChangeConfiguration((event) => {
      let toReboot = new Set<WorkspaceFolder>()

      Workspace.textDocuments.forEach((document) => {
        let folder = Workspace.getWorkspaceFolder(document.uri)
        if (!folder) return
        if (event.affectsConfiguration('tailwindCSS.experimental.configFile', folder)) {
          toReboot.add(folder)
        }
      })
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
          toReboot.add(folder)
        }
      })

      for (let folder of toReboot) {
        clients.get(folder.uri.toString())?.stop()
        clients.delete(folder.uri.toString())
        bootClientForFolderIfNeeded(folder)
      }
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
        pattern: normalizePath(`${folder.uri.fsPath.replace(/[\[\]\{\}]/g, '?')}/**/*`),
      })),
      diagnosticCollectionName: CLIENT_ID,
      workspaceFolder: folder,
      outputChannel: outputChannel,
      revealOutputChannelOn: RevealOutputChannelOn.Never,
      middleware: {
        provideCompletionItem(document, position, context, token, next) {
          let workspaceFolder = Workspace.getWorkspaceFolder(document.uri)
          if (workspaceFolder !== folder) {
            return null
          }
          return next(document, position, context, token)
        },
        provideHover(document, position, token, next) {
          let workspaceFolder = Workspace.getWorkspaceFolder(document.uri)
          if (workspaceFolder !== folder) {
            return null
          }
          return next(document, position, token)
        },
        handleDiagnostics(uri, diagnostics, next) {
          let workspaceFolder = Workspace.getWorkspaceFolder(uri)
          if (workspaceFolder !== folder) {
            return
          }
          next(uri, diagnostics)
        },
        provideCodeActions(document, range, context, token, next) {
          let workspaceFolder = Workspace.getWorkspaceFolder(document.uri)
          if (workspaceFolder !== folder) {
            return null
          }
          return next(document, range, context, token)
        },
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
          let workspaceFolder = Workspace.getWorkspaceFolder(document.uri)
          if (workspaceFolder !== folder) {
            return null
          }

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
                    uri: Uri.parse(scopeUri),
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
        workspaceFile:
          Workspace.workspaceFile?.scheme === 'file' ? Workspace.workspaceFile.fsPath : undefined,
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

    client.onNotification('@/tailwindCSS/projectInitialized', async () => {
      await updateActiveTextEditorContext()
    })
    client.onNotification('@/tailwindCSS/projectReset', async () => {
      await updateActiveTextEditorContext()
    })
    client.onNotification('@/tailwindCSS/projectsDestroyed', () => {
      resetActiveTextEditorContext()
    })

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

  async function bootClientForFolderIfNeeded(folder: WorkspaceFolder): Promise<void> {
    let settings = Workspace.getConfiguration('tailwindCSS', folder)
    if (settings.get('experimental.configFile') !== null) {
      bootWorkspaceClient(folder)
      return
    }

    let exclude = `{${getExcludePatterns(folder)
      .flatMap((pattern) => braces.expand(pattern))
      .join(',')
      .replace(/{/g, '%7B')
      .replace(/}/g, '%7D')}}`

    let [configFile] = await Workspace.findFiles(
      new RelativePattern(folder, `**/${CONFIG_GLOB}`),
      exclude,
      1
    )

    if (configFile) {
      bootWorkspaceClient(folder)
      return
    }

    let cssFiles = await Workspace.findFiles(new RelativePattern(folder, `**/${CSS_GLOB}`), exclude)

    for (let cssFile of cssFiles) {
      if (await fileContainsAtConfig(cssFile)) {
        bootWorkspaceClient(folder)
        return
      }
    }
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

    if (searchedFolders.has(folder.uri.toString())) {
      return
    }

    searchedFolders.add(folder.uri.toString())

    await bootClientForFolderIfNeeded(folder)
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
