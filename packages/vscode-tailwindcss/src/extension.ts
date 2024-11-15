import * as path from 'path'
import type {
  ExtensionContext,
  TextDocument,
  WorkspaceFolder,
  ConfigurationScope,
  WorkspaceConfiguration,
  Selection,
} from 'vscode'
import {
  workspace as Workspace,
  window as Window,
  Uri,
  commands,
  SymbolInformation,
  Position,
  Range,
  RelativePattern,
  languages,
} from 'vscode'
import type {
  DocumentFilter,
  LanguageClientOptions,
  ServerOptions,
} from 'vscode-languageclient/node'
import {
  LanguageClient,
  TransportKind,
  State as LanguageClientState,
  RevealOutputChannelOn,
} from 'vscode-languageclient/node'
import { languages as defaultLanguages } from '@tailwindcss/language-service/src/util/languages'
import * as semver from '@tailwindcss/language-service/src/util/semver'
import isObject from '@tailwindcss/language-service/src/util/isObject'
import namedColors from 'color-name'
import picomatch from 'picomatch'
import { CONFIG_GLOB, CSS_GLOB } from '@tailwindcss/language-server/src/lib/constants'
import braces from 'braces'
import normalizePath from 'normalize-path'
import * as servers from './servers/index'

const colorNames = Object.keys(namedColors)

const CLIENT_ID = 'tailwindcss-intellisense'
const CLIENT_NAME = 'Tailwind CSS IntelliSense'

let currentClient: Promise<LanguageClient> | null = null

function getUserLanguages(folder?: WorkspaceFolder): Record<string, string> {
  const langs = Workspace.getConfiguration('tailwindCSS', folder).includeLanguages
  return isObject(langs) ? langs : {}
}

function getGlobalExcludePatterns(scope: ConfigurationScope | null): string[] {
  return Object.entries(Workspace.getConfiguration('files', scope)?.get('exclude') ?? [])
    .filter(([, value]) => value === true)
    .map(([key]) => key)
    .filter(Boolean)
}

function getExcludePatterns(scope: ConfigurationScope | null): string[] {
  return [
    ...getGlobalExcludePatterns(scope),
    ...(<string[]>Workspace.getConfiguration('tailwindCSS', scope).get('files.exclude')).filter(
      Boolean,
    ),
  ]
}

function isExcluded(file: string, folder: WorkspaceFolder): boolean {
  for (let pattern of getExcludePatterns(folder)) {
    let matcher = picomatch(path.join(folder.uri.fsPath, pattern))

    if (matcher(file)) {
      return true
    }
  }

  return false
}

function mergeExcludes(settings: WorkspaceConfiguration, scope: ConfigurationScope | null): any {
  return {
    ...settings,
    files: {
      ...settings.files,
      exclude: getExcludePatterns(scope),
    },
  }
}

async function fileMayBeTailwindRelated(uri: Uri) {
  let contents = (await Workspace.fs.readFile(uri)).toString()

  let HAS_CONFIG = /@config\s*['"]/
  let HAS_IMPORT = /@import\s*['"]/
  let HAS_TAILWIND = /@tailwind\s*[^;]+;/
  let HAS_THEME = /@theme\s*\{/

  return (
    HAS_CONFIG.test(contents) ||
    HAS_IMPORT.test(contents) ||
    HAS_TAILWIND.test(contents) ||
    HAS_THEME.test(contents)
  )
}

function selectionsAreEqual(
  aSelections: readonly Selection[],
  bSelections: readonly Selection[],
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
  // No editor, no project
  let editor = Window.activeTextEditor
  if (!editor) return null

  return projectForDocument(editor.document)
}

async function projectForDocument(document: TextDocument): Promise<{ version: string } | null> {
  // No server yet, no project
  if (!currentClient) return null

  // No workspace folder, no project
  let uri = document.uri
  let folder = Workspace.getWorkspaceFolder(uri)
  if (!folder) return null

  // Excluded file, no project
  if (isExcluded(uri.fsPath, folder)) return null

  interface ProjectData {
    version: string
  }

  // Ask the server for the project
  try {
    let client = await currentClient
    let project = await client.sendRequest<ProjectData>('@/tailwindCSS/getProject', {
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

const switchedDocuments = new Set<string>()

async function switchDocumentLanguageIfNeeded(document: TextDocument): Promise<void> {
  // Consider documents that are already in `tailwindcss` language mode as
  // having been switched automatically. This ensures that a user can still
  // manually switch this document to `css` and have it stay that way.
  if (document.languageId === 'tailwindcss') {
    switchedDocuments.add(document.uri.toString())
    return
  }

  if (document.languageId !== 'css') return

  // When a document is manually switched back to the `css` language we do not
  // want to switch it back to `tailwindcss` because the user has explicitly
  // chosen to use the `css` language mode.
  if (switchedDocuments.has(document.uri.toString())) return

  let project = await projectForDocument(document)
  if (!project) return

  // CSS files in a known project should be switched to `tailwindcss`
  // when they are opened
  languages.setTextDocumentLanguage(document, 'tailwindcss')
  switchedDocuments.add(document.uri.toString())
}

async function updateActiveTextEditorContext(): Promise<void> {
  commands.executeCommand(
    'setContext',
    'tailwindCSS.activeTextEditorSupportsClassSorting',
    await activeTextEditorSupportsClassSorting(),
  )

  await Promise.all(Workspace.textDocuments.map(switchDocumentLanguageIfNeeded))
}

function resetActiveTextEditorContext(): void {
  commands.executeCommand('setContext', 'tailwindCSS.activeTextEditorSupportsClassSorting', false)
}

export async function activate(context: ExtensionContext) {
  switchedDocuments.clear()

  let outputChannel = Window.createOutputChannel(CLIENT_NAME)
  context.subscriptions.push(outputChannel)
  context.subscriptions.push(
    commands.registerCommand('tailwindCSS.showOutput', () => {
      if (outputChannel) {
        outputChannel.show()
      }
    }),
  )

  await commands.executeCommand('setContext', 'tailwindCSS.hasOutputChannel', true)

  outputChannel.appendLine(`Locating server…`)

  let module = context.asAbsolutePath(path.join('dist', 'server.js'))
  let prod = path.join('dist', 'tailwindServer.js')

  try {
    await Workspace.fs.stat(Uri.joinPath(context.extensionUri, prod))
    module = context.asAbsolutePath(prod)
  } catch (_) {}

  async function sortSelection(): Promise<void> {
    if (!Window.activeTextEditor) return

    let { document, selections } = Window.activeTextEditor

    if (selections.length === 0) {
      return
    }

    let initialSelections = selections
    let folder = Workspace.getWorkspaceFolder(document.uri)

    if (!currentClient || !folder || isExcluded(document.uri.fsPath, folder)) {
      throw Error(`No active Tailwind project found for file ${document.uri.fsPath}`)
    }

    let client = await currentClient

    let result = await client.sendRequest<{ error: string } | { classLists: string[] }>(
      '@/tailwindCSS/sortSelection',
      {
        uri: document.uri.toString(),
        classLists: selections.map((selection) => document.getText(selection)),
      },
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
        }[result.error] ?? 'An unknown error occurred.',
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
        Window.showWarningMessage(`Couldn’t sort Tailwind classes: ${(error as any)?.message}`)
      }
    }),
  )

  context.subscriptions.push(
    Window.onDidChangeActiveTextEditor(async () => {
      await updateActiveTextEditorContext()
    }),
  )

  let configWatcher = Workspace.createFileSystemWatcher(`**/${CONFIG_GLOB}`, false, true, true)

  configWatcher.onDidCreate(async (uri) => {
    let folder = Workspace.getWorkspaceFolder(uri)
    if (!folder || isExcluded(uri.fsPath, folder)) {
      return
    }
    await bootWorkspaceClient()
  })

  context.subscriptions.push(configWatcher)

  let cssWatcher = Workspace.createFileSystemWatcher(`**/${CSS_GLOB}`, false, false, true)

  async function bootClientIfCssFileMayBeTailwindRelated(uri: Uri) {
    let folder = Workspace.getWorkspaceFolder(uri)
    if (!folder || isExcluded(uri.fsPath, folder)) {
      return
    }
    if (await fileMayBeTailwindRelated(uri)) {
      await bootWorkspaceClient()
    }
  }

  cssWatcher.onDidCreate(bootClientIfCssFileMayBeTailwindRelated)
  cssWatcher.onDidChange(bootClientIfCssFileMayBeTailwindRelated)

  context.subscriptions.push(cssWatcher)

  // TODO: check if the actual language MAPPING changed
  // not just the language IDs
  // e.g. "plaintext" already exists but you change it from "html" to "css"
  context.subscriptions.push(
    Workspace.onDidChangeConfiguration(async (event) => {
      let folders = Workspace.workspaceFolders ?? []

      let needsReboot = folders.some((folder) => {
        return (
          event.affectsConfiguration('tailwindCSS.experimental.configFile', folder) ||
          // TODO: Only reboot if the MAPPING changed instead of just the languages
          // e.g. "plaintext" already exists but you change it from "html" to "css"
          // TODO: This should not cause a reboot of the server but should instead
          // have the server update its internal state
          event.affectsConfiguration('tailwindCSS.includeLanguages', folder)
        )
      })

      if (!needsReboot) {
        return
      }

      // Stop the current server (if any)
      if (currentClient) {
        let client = await currentClient
        await client.stop()
      }

      currentClient = null

      // Start the server again with the new configuration
      await bootWorkspaceClient()
    }),
  )

  function bootWorkspaceClient() {
    currentClient ??= bootIfNeeded()

    return currentClient
  }

  async function bootIfNeeded() {
    outputChannel.appendLine(`Booting server...`)

    let colorDecorationType = Window.createTextEditorDecorationType({
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

    context.subscriptions.push(colorDecorationType)

    /**
     * Clear all decorated colors from all visible text editors
     */
    function clearColors(): void {
      for (let editor of Window.visibleTextEditors) {
        editor.setDecorations(colorDecorationType!, [])
      }
    }

    let documentFilters: DocumentFilter[] = []

    for (let folder of Workspace.workspaceFolders ?? []) {
      let langs = new Set([...defaultLanguages, ...Object.keys(getUserLanguages(folder))])

      for (let language of langs) {
        documentFilters.push({
          scheme: 'file',
          language,
          pattern: normalizePath(`${folder.uri.fsPath.replace(/[\[\]\{\}]/g, '?')}/**/*`),
        })
      }
    }

    let module = context.asAbsolutePath(path.join('dist', 'server.js'))
    let prod = path.join('dist', 'tailwindServer.js')

    try {
      await Workspace.fs.stat(Uri.joinPath(context.extensionUri, prod))
      module = context.asAbsolutePath(prod)
    } catch (_) {}

    let workspaceFile =
      Workspace.workspaceFile?.scheme === 'file' ? Workspace.workspaceFile : undefined
    let inspectPort =
      Workspace.getConfiguration('tailwindCSS', workspaceFile).get<number | null>('inspectPort') ??
      null

    let serverOptions: ServerOptions = {
      run: {
        module,
        transport: TransportKind.ipc,
        options: {
          execArgv: inspectPort === null ? [] : [`--inspect=${inspectPort}`],
        },
      },
      debug: {
        module,
        transport: TransportKind.ipc,
        options: {
          execArgv: ['--nolazy', `--inspect=6011`],
        },
      },
    }

    let clientOptions: LanguageClientOptions = {
      documentSelector: documentFilters,
      diagnosticCollectionName: CLIENT_ID,
      outputChannel: outputChannel,
      revealOutputChannelOn: RevealOutputChannelOn.Never,
      middleware: {
        async resolveCompletionItem(item, token, next) {
          let editor = Window.activeTextEditor
          if (!editor) return null

          let result = await next(item, token)
          if (!result) return result

          let selections = editor.selections
          let edits = result.additionalTextEdits || []

          if (selections.length <= 1 || edits.length === 0 || result['data'] !== 'variant') {
            return result
          }

          let length = selections[0].start.character - edits[0].range.start.character
          let prefixLength = edits[0].range.end.character - edits[0].range.start.character

          let ranges = selections.map((selection) => {
            return new Range(
              new Position(selection.start.line, selection.start.character - length),
              new Position(selection.start.line, selection.start.character - length + prefixLength),
            )
          })
          if (
            ranges
              .map((range) => editor!.document.getText(range))
              .every((text, _index, arr) => arr.indexOf(text) === 0)
          ) {
            // all the same
            result.additionalTextEdits = ranges.map((range) => {
              return { range, newText: edits[0].newText }
            })
          } else {
            result.insertText = typeof result.label === 'string' ? result.label : result.label.label
            result.additionalTextEdits = []
          }

          return result
        },

        async provideDocumentColors(document, token, next) {
          let colors = await next(document, token)
          if (!colors) return colors

          let editableColors = colors.filter((color) => {
            let text =
              Workspace.textDocuments.find((doc) => doc === document)?.getText(color.range) ?? ''
            return new RegExp(
              `-\\[(${colorNames.join('|')}|((?:#|rgba?\\(|hsla?\\())[^\\]]+)\\]$`,
            ).test(text)
          })

          let nonEditableColors = colors.filter((color) => !editableColors.includes(color))

          let editors = Window.visibleTextEditors.filter((editor) => editor.document === document)

          // Make sure we show document colors for all visible editors
          // Not just the first one for a given document
          for (let editor of editors) {
            editor.setDecorations(
              colorDecorationType,
              nonEditableColors.map(({ range, color }) => ({
                range,
                renderOptions: {
                  before: {
                    backgroundColor: `rgba(${color.red * 255}, ${color.green * 255}, ${color.blue * 255}, ${color.alpha})`,
                  },
                },
              })),
            )
          }

          return editableColors
        },

        workspace: {
          configuration: (params) => {
            return params.items.map(({ section, scopeUri }) => {
              let scope: ConfigurationScope | null = null

              if (scopeUri) {
                let uri = Uri.parse(scopeUri)
                let doc = Workspace.textDocuments.find((doc) => doc.uri.toString() === scopeUri)

                // Make sure we ask VSCode for language specific settings for
                // the document as it does not do this automatically
                if (doc) {
                  scope = {
                    uri,
                    languageId: doc.languageId,
                  }
                } else {
                  scope = uri
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
        workspaceFile: workspaceFile?.fsPath ?? undefined,
      },
    }

    let client = new LanguageClient(CLIENT_ID, CLIENT_NAME, serverOptions, clientOptions)

    client.onNotification('@/tailwindCSS/error', showError)
    client.onNotification('@/tailwindCSS/clearColors', clearColors)
    client.onNotification('@/tailwindCSS/projectInitialized', updateActiveTextEditorContext)
    client.onNotification('@/tailwindCSS/projectReset', updateActiveTextEditorContext)
    client.onNotification('@/tailwindCSS/projectsDestroyed', resetActiveTextEditorContext)
    client.onRequest('@/tailwindCSS/getDocumentSymbols', showSymbols)

    interface ErrorNotification {
      message: string
    }

    async function showError({ message }: ErrorNotification) {
      let action = await Window.showErrorMessage(message, 'Go to output')
      if (action !== 'Go to output') return
      commands.executeCommand('tailwindCSS.showOutput')
    }

    interface DocumentSymbolsRequest {
      uri: string
    }

    function showSymbols({ uri }: DocumentSymbolsRequest) {
      return commands.executeCommand<SymbolInformation[]>(
        'vscode.executeDocumentSymbolProvider',
        Uri.parse(uri),
      )
    }

    client.onDidChangeState(({ newState }) => {
      if (newState !== LanguageClientState.Stopped) return
      clearColors()
    })

    await client.start()

    return client
  }

  async function bootClientIfNeeded(): Promise<void> {
    if (currentClient) {
      return
    }

    if (!await anyFolderNeedsLanguageServer(Workspace.workspaceFolders ?? [])) {
      return
    }

    await bootWorkspaceClient()
  }

  async function anyFolderNeedsLanguageServer(
    folders: readonly WorkspaceFolder[],
  ): Promise<boolean> {
    for (let folder of folders) {
      if (await folderNeedsLanguageServer(folder)) {
        return true
      }
    }

    return false
  }

  async function folderNeedsLanguageServer(folder: WorkspaceFolder): Promise<boolean> {
    let settings = Workspace.getConfiguration('tailwindCSS', folder)
    if (settings.get('experimental.configFile') !== null) {
      return true
    }

    let exclude = `{${getExcludePatterns(folder)
      .flatMap((pattern) => braces.expand(pattern))
      .join(',')
      .replace(/{/g, '%7B')
      .replace(/}/g, '%7D')}}`

    let configFiles = await Workspace.findFiles(
      new RelativePattern(folder, `**/${CONFIG_GLOB}`),
      exclude,
      1,
    )

    for (let file of configFiles) {
      return true
    }

    let cssFiles = await Workspace.findFiles(new RelativePattern(folder, `**/${CSS_GLOB}`), exclude)

    for (let file of cssFiles) {
      outputChannel.appendLine(`Checking if ${file.fsPath} may be Tailwind-related…`)

      if (await fileMayBeTailwindRelated(file)) {
        return true
      }
    }

    return false
  }

  async function didOpenTextDocument(document: TextDocument): Promise<void> {
    await switchDocumentLanguageIfNeeded(document)

    if (document.languageId === 'tailwindcss') {
      servers.css.boot(context, outputChannel)
    }

    // We are only interested in language mode text
    if (document.uri.scheme !== 'file') {
      return
    }

    let uri = document.uri
    let folder = Workspace.getWorkspaceFolder(uri)

    // Files outside a folder can't be handled. This might depend on the language.
    // Single file languages like JSON might handle files outside the workspace folders.
    if (!folder) return

    await bootClientIfNeeded()
  }

  context.subscriptions.push(Workspace.onDidOpenTextDocument(didOpenTextDocument))
  Workspace.textDocuments.forEach(didOpenTextDocument)
  context.subscriptions.push(
    Workspace.onDidChangeWorkspaceFolders(async () => {
      let folderCount = Workspace.workspaceFolders?.length ?? 0
      if (folderCount > 0) return
      if (!currentClient) return

      let client = await currentClient
      client.stop()
      currentClient = null
    }),
  )
}

export async function deactivate(): Promise<void> {
  if (!currentClient) return

  let client = await currentClient
  await client.stop()
}
