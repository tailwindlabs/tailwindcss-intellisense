import {
  getCSSLanguageService,
  LanguageSettings,
  DocumentContext,
} from 'vscode-css-languageservice/lib/esm/cssLanguageService'
import {
  createConnection,
  InitializeParams,
  ProposedFeatures,
  TextDocuments,
  TextDocumentSyncKind,
  WorkspaceFolder,
  Disposable,
  ConfigurationRequest,
  CompletionItemKind,
} from 'vscode-languageserver/node'
import { TextDocument } from 'vscode-languageserver-textdocument'
import { Utils, URI } from 'vscode-uri'
import { getLanguageModelCache } from './languageModelCache'
import { Stylesheet } from 'vscode-css-languageservice'
import dlv from 'dlv'
import { interceptLogs } from '../util/logs'

let connection = createConnection(ProposedFeatures.all)

interceptLogs(console, connection)

process.on('unhandledRejection', (e: any) => {
  console.error('Unhandled exception', e)
})

let documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument)

let cssLanguageService = getCSSLanguageService()

let workspaceFolders: WorkspaceFolder[]

let foldingRangeLimit = Number.MAX_VALUE
const MEDIA_MARKER = '℘'

const stylesheets = getLanguageModelCache<Stylesheet>(10, 60, (document) =>
  cssLanguageService.parseStylesheet(document),
)
documents.onDidClose(({ document }) => {
  stylesheets.onDocumentRemoved(document)
})
connection.onShutdown(() => {
  stylesheets.dispose()
})

connection.onInitialize((params: InitializeParams) => {
  workspaceFolders = (<any>params).workspaceFolders
  if (!Array.isArray(workspaceFolders)) {
    workspaceFolders = []
    if (params.rootPath) {
      workspaceFolders.push({ name: '', uri: URI.file(params.rootPath).toString() })
    }
  }

  foldingRangeLimit = dlv(
    params.capabilities,
    'textDocument.foldingRange.rangeLimit',
    Number.MAX_VALUE,
  )

  return {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Full,
      completionProvider: { resolveProvider: false, triggerCharacters: ['/', '-', ':'] },
      hoverProvider: true,
      foldingRangeProvider: true,
      colorProvider: {},
      definitionProvider: true,
      documentHighlightProvider: true,
      documentSymbolProvider: true,
      selectionRangeProvider: true,
      referencesProvider: true,
      codeActionProvider: true,
      documentLinkProvider: { resolveProvider: false },
      renameProvider: true,
    },
  }
})

function getDocumentContext(
  documentUri: string,
  workspaceFolders: WorkspaceFolder[],
): DocumentContext {
  function getRootFolder(): string | undefined {
    for (let folder of workspaceFolders) {
      let folderURI = folder.uri
      if (!folderURI.endsWith('/')) {
        folderURI = folderURI + '/'
      }
      if (documentUri.startsWith(folderURI)) {
        return folderURI
      }
    }
    return undefined
  }

  return {
    resolveReference: (ref: string, base = documentUri) => {
      if (ref[0] === '/') {
        // resolve absolute path against the current workspace folder
        let folderUri = getRootFolder()
        if (folderUri) {
          return folderUri + ref.substr(1)
        }
      }
      base = base.substr(0, base.lastIndexOf('/') + 1)
      return Utils.resolvePath(URI.parse(base), ref).toString()
    },
  }
}

async function withDocumentAndSettings<T>(
  uri: string,
  callback: (result: {
    document: TextDocument
    settings: LanguageSettings | undefined
  }) => T | Promise<T>,
): Promise<T> {
  let document = documents.get(uri)
  if (!document) {
    return null
  }
  return await callback({
    document: createVirtualCssDocument(document),
    settings: await getDocumentSettings(document),
  })
}

connection.onCompletion(async ({ textDocument, position }, _token) =>
  withDocumentAndSettings(textDocument.uri, async ({ document, settings }) => {
    let result = await cssLanguageService.doComplete2(
      document,
      position,
      stylesheets.get(document),
      getDocumentContext(document.uri, workspaceFolders),
      settings?.completion,
    )
    return {
      isIncomplete: result.isIncomplete,
      items: result.items.flatMap((item) => {
        // Add the `theme()` function
        if (item.kind === CompletionItemKind.Function && item.label === 'calc()') {
          return [
            item,
            {
              ...item,
              label: 'theme()',
              filterText: 'theme',
              documentation: {
                kind: 'markdown',
                value:
                  'Use the `theme()` function to access your Tailwind config values using dot notation.',
              },
              command: {
                title: '',
                command: 'editor.action.triggerSuggest',
              },
              textEdit: {
                ...item.textEdit,
                newText: item.textEdit.newText.replace(/^calc\(/, 'theme('),
              },
            },
          ]
        }
        return item
      }),
    }
  }),
)

connection.onHover(({ textDocument, position }, _token) =>
  withDocumentAndSettings(textDocument.uri, ({ document, settings }) =>
    cssLanguageService.doHover(document, position, stylesheets.get(document), settings?.hover),
  ),
)

connection.onFoldingRanges(({ textDocument }, _token) =>
  withDocumentAndSettings(textDocument.uri, ({ document }) =>
    cssLanguageService.getFoldingRanges(document, { rangeLimit: foldingRangeLimit }),
  ),
)

connection.onDocumentColor(({ textDocument }) =>
  withDocumentAndSettings(textDocument.uri, ({ document }) =>
    cssLanguageService.findDocumentColors(document, stylesheets.get(document)),
  ),
)

connection.onColorPresentation(({ textDocument, color, range }) =>
  withDocumentAndSettings(textDocument.uri, ({ document }) =>
    cssLanguageService.getColorPresentations(document, stylesheets.get(document), color, range),
  ),
)

connection.onDefinition(({ textDocument, position }) =>
  withDocumentAndSettings(textDocument.uri, ({ document }) =>
    cssLanguageService.findDefinition(document, position, stylesheets.get(document)),
  ),
)

connection.onDocumentHighlight(({ textDocument, position }) =>
  withDocumentAndSettings(textDocument.uri, ({ document }) =>
    cssLanguageService.findDocumentHighlights(document, position, stylesheets.get(document)),
  ),
)

connection.onDocumentSymbol(({ textDocument }) =>
  withDocumentAndSettings(textDocument.uri, ({ document }) =>
    cssLanguageService.findDocumentSymbols(document, stylesheets.get(document)).map((symbol) => {
      if (symbol.name === `@media (${MEDIA_MARKER})`) {
        let doc = documents.get(symbol.location.uri)
        let text = doc.getText(symbol.location.range)
        let match = text.trim().match(/^(@[^\s]+)([^{]+){/)
        if (match) {
          symbol.name = `${match[1]} ${match[2].trim()}`
        }
      }
      return symbol
    }),
  ),
)

connection.onSelectionRanges(({ textDocument, positions }) =>
  withDocumentAndSettings(textDocument.uri, ({ document }) =>
    cssLanguageService.getSelectionRanges(document, positions, stylesheets.get(document)),
  ),
)

connection.onReferences(({ textDocument, position }) =>
  withDocumentAndSettings(textDocument.uri, ({ document }) =>
    cssLanguageService.findReferences(document, position, stylesheets.get(document)),
  ),
)

connection.onCodeAction(({ textDocument, range, context }) =>
  withDocumentAndSettings(textDocument.uri, ({ document }) =>
    cssLanguageService.doCodeActions2(document, range, context, stylesheets.get(document)),
  ),
)

connection.onDocumentLinks(({ textDocument }) =>
  withDocumentAndSettings(textDocument.uri, ({ document }) =>
    cssLanguageService.findDocumentLinks2(
      document,
      stylesheets.get(document),
      getDocumentContext(document.uri, workspaceFolders),
    ),
  ),
)

connection.onRenameRequest(({ textDocument, position, newName }) =>
  withDocumentAndSettings(textDocument.uri, ({ document }) =>
    cssLanguageService.doRename(document, position, newName, stylesheets.get(document)),
  ),
)

let documentSettings: { [key: string]: Thenable<LanguageSettings | undefined> } = {}
documents.onDidClose((e) => {
  delete documentSettings[e.document.uri]
})
function getDocumentSettings(textDocument: TextDocument): Thenable<LanguageSettings | undefined> {
  let promise = documentSettings[textDocument.uri]
  if (!promise) {
    const configRequestParam = {
      items: [{ scopeUri: textDocument.uri, section: 'css' }],
    }
    promise = connection
      .sendRequest(ConfigurationRequest.type, configRequestParam)
      .then((s) => s[0])
    documentSettings[textDocument.uri] = promise
  }
  return promise
}

connection.onDidChangeConfiguration((change) => {
  updateConfiguration(<LanguageSettings>change.settings.css)
})

function updateConfiguration(settings: LanguageSettings) {
  cssLanguageService.configure(settings)
  // reset all document settings
  documentSettings = {}
  documents.all().forEach(triggerValidation)
}

const pendingValidationRequests: { [uri: string]: Disposable } = {}
const validationDelayMs = 500

const timer = {
  setTimeout(callback: (...args: any[]) => void, ms: number, ...args: any[]): Disposable {
    const handle = setTimeout(callback, ms, ...args)
    return { dispose: () => clearTimeout(handle) }
  },
}

documents.onDidChangeContent((change) => {
  triggerValidation(change.document)
})

documents.onDidClose((event) => {
  cleanPendingValidation(event.document)
  connection.sendDiagnostics({ uri: event.document.uri, diagnostics: [] })
})

function cleanPendingValidation(textDocument: TextDocument): void {
  const request = pendingValidationRequests[textDocument.uri]
  if (request) {
    request.dispose()
    delete pendingValidationRequests[textDocument.uri]
  }
}

function triggerValidation(textDocument: TextDocument): void {
  cleanPendingValidation(textDocument)
  pendingValidationRequests[textDocument.uri] = timer.setTimeout(() => {
    delete pendingValidationRequests[textDocument.uri]
    validateTextDocument(textDocument)
  }, validationDelayMs)
}

function replace(delta = 0) {
  return (_match: string, p1: string) => {
    let lines = p1.split('\n')
    if (lines.length > 1) {
      return `@media(${MEDIA_MARKER})${'\n'.repeat(lines.length - 1)}${' '.repeat(
        lines[lines.length - 1].length,
      )}{`
    }
    return `@media(${MEDIA_MARKER})${' '.repeat(p1.length + delta)}{`
  }
}

function createVirtualCssDocument(textDocument: TextDocument): TextDocument {
  return TextDocument.create(
    textDocument.uri,
    textDocument.languageId,
    textDocument.version,
    textDocument
      .getText()
      .replace(/@screen(\s+[^{]+){/g, replace(-2))
      .replace(/@variants(\s+[^{]+){/g, replace())
      .replace(/@responsive(\s*){/g, replace())
      .replace(/@layer(\s+[^{]{2,}){/g, replace(-3))
      .replace(
        /@media(\s+screen\s*\([^)]+\))/g,
        (_match, screen) => `@media (${MEDIA_MARKER})${' '.repeat(screen.length - 4)}`,
      )
      .replace(/(?<=\b(?:theme|config)\([^)]*)[.[\]]/g, '_'),
  )
}

async function validateTextDocument(textDocument: TextDocument): Promise<void> {
  textDocument = createVirtualCssDocument(textDocument)

  let settings = await getDocumentSettings(textDocument)

  // let stylesheet = cssLanguageService.parseStylesheet(textDocument) as any
  // stylesheet.acceptVisitor({
  //   visitNode(node) {
  //     if (node instanceof nodes.UnknownAtRule) {
  //       console.log(
  //         node.accept((node) => {
  //           console.log(node)
  //         })
  //       )
  //     }
  //     if (node.getText().includes('base')) {
  //       // console.log(node)
  //     }
  //     return true
  //   },
  // })

  let diagnostics = cssLanguageService
    .doValidation(textDocument, cssLanguageService.parseStylesheet(textDocument), settings)
    .filter((diagnostic) => {
      if (
        diagnostic.code === 'unknownAtRules' &&
        /Unknown at rule @(tailwind|apply|config|theme)/.test(diagnostic.message)
      ) {
        return false
      }
      return true
    })

  connection.sendDiagnostics({ uri: textDocument.uri, diagnostics })
}

documents.listen(connection)
connection.listen()
