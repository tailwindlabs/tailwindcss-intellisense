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
} from 'vscode-languageserver/node'
import { TextDocument } from 'vscode-languageserver-textdocument'
import { Utils, URI } from 'vscode-uri'

let connection = createConnection(ProposedFeatures.all)
let documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument)

let cssLanguageService = getCSSLanguageService()

let workspaceFolders: WorkspaceFolder[]

connection.onInitialize((params: InitializeParams) => {
  workspaceFolders = (<any>params).workspaceFolders
  if (!Array.isArray(workspaceFolders)) {
    workspaceFolders = []
    if (params.rootPath) {
      workspaceFolders.push({ name: '', uri: URI.file(params.rootPath).toString() })
    }
  }

  return {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Full,
      completionProvider: { resolveProvider: false },
      hoverProvider: true,
      foldingRangeProvider: true,
      colorProvider: true,
      definitionProvider: true,
      documentHighlightProvider: true,
      documentSymbolProvider: true,
      selectionRangeProvider: true,
      referencesProvider: true,
      codeActionProvider: { resolveProvider: false },
      documentLinkProvider: { resolveProvider: false },
    },
  }
})

function getDocumentContext(
  documentUri: string,
  workspaceFolders: WorkspaceFolder[]
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
  augmentCss: boolean,
  callback: (result: { document: TextDocument; settings: LanguageSettings }) => T | Promise<T>
): Promise<T> {
  let document = documents.get(uri)
  if (!document) {
    return null
  }
  return await callback({
    document: augmentCss ? createVirtualCssDocument(document) : document,
    settings: await getDocumentSettings(uri),
  })
}

connection.onCompletion(async ({ textDocument, position }, _token) =>
  withDocumentAndSettings(textDocument.uri, true, ({ document, settings }) =>
    cssLanguageService.doComplete2(
      document,
      position,
      cssLanguageService.parseStylesheet(document),
      getDocumentContext(document.uri, workspaceFolders),
      settings.completion
    )
  )
)

connection.onHover(({ textDocument, position }, _token) =>
  withDocumentAndSettings(textDocument.uri, true, ({ document, settings }) =>
    cssLanguageService.doHover(
      document,
      position,
      cssLanguageService.parseStylesheet(document),
      settings.hover
    )
  )
)

connection.onFoldingRanges(({ textDocument }, _token) =>
  withDocumentAndSettings(textDocument.uri, false, ({ document }) =>
    cssLanguageService.getFoldingRanges(document)
  )
)

connection.onDocumentColor(({ textDocument }) =>
  withDocumentAndSettings(textDocument.uri, true, ({ document }) =>
    cssLanguageService.findDocumentColors(document, cssLanguageService.parseStylesheet(document))
  )
)

connection.onColorPresentation(({ textDocument, color, range }) =>
  withDocumentAndSettings(textDocument.uri, false, ({ document }) =>
    cssLanguageService.getColorPresentations(
      document,
      cssLanguageService.parseStylesheet(document),
      color,
      range
    )
  )
)

connection.onDefinition(({ textDocument, position }) =>
  withDocumentAndSettings(textDocument.uri, true, ({ document }) =>
    cssLanguageService.findDefinition(
      document,
      position,
      cssLanguageService.parseStylesheet(document)
    )
  )
)

connection.onDocumentHighlight(({ textDocument, position }) =>
  withDocumentAndSettings(textDocument.uri, false, ({ document }) =>
    cssLanguageService.findDocumentHighlights(
      document,
      position,
      cssLanguageService.parseStylesheet(document)
    )
  )
)

connection.onDocumentSymbol(({ textDocument }) =>
  withDocumentAndSettings(textDocument.uri, true, ({ document }) =>
    cssLanguageService
      .findDocumentSymbols(document, cssLanguageService.parseStylesheet(document))
      .map((symbol) => {
        if (symbol.name === '@media (_)') {
          let doc = documents.get(symbol.location.uri)
          let text = doc.getText(symbol.location.range)
          let match = text.trim().match(/^(@[^\s]+)([^{]+){/)
          if (match) {
            symbol.name = `${match[1]} ${match[2].trim()}`
          }
        }
        return symbol
      })
  )
)

connection.onSelectionRanges(({ textDocument, positions }) =>
  withDocumentAndSettings(textDocument.uri, false, ({ document }) =>
    cssLanguageService.getSelectionRanges(
      document,
      positions,
      cssLanguageService.parseStylesheet(document)
    )
  )
)

connection.onReferences(({ textDocument, position }) =>
  withDocumentAndSettings(textDocument.uri, false, ({ document }) =>
    cssLanguageService.findReferences(
      document,
      position,
      cssLanguageService.parseStylesheet(document)
    )
  )
)

connection.onCodeAction(({ textDocument, range, context }) =>
  withDocumentAndSettings(textDocument.uri, false, ({ document }) =>
    cssLanguageService.doCodeActions2(
      document,
      range,
      context,
      cssLanguageService.parseStylesheet(document)
    )
  )
)

connection.onDocumentLinks(({ textDocument }) =>
  withDocumentAndSettings(textDocument.uri, false, ({ document }) =>
    cssLanguageService.findDocumentLinks2(
      document,
      cssLanguageService.parseStylesheet(document),
      getDocumentContext(document.uri, workspaceFolders)
    )
  )
)

let documentSettings: Map<string, Thenable<LanguageSettings>> = new Map()
function getDocumentSettings(resource: string): Thenable<LanguageSettings> {
  let result = documentSettings.get(resource)
  if (!result) {
    result = connection.workspace.getConfiguration({
      scopeUri: resource,
      section: 'css',
    })
    documentSettings.set(resource, result)
  }
  return result
}

connection.onDidChangeConfiguration((_change) => {
  documentSettings.clear()
  documents.all().forEach(validateTextDocument)
})

documents.onDidChangeContent((change) => {
  validateTextDocument(change.document)
})

documents.onDidClose((e) => {
  documentSettings.delete(e.document.uri)
})

function replace(delta = 0) {
  return (_match: string, p1: string) => {
    let lines = p1.split('\n')
    if (lines.length > 1) {
      return `@media(_)${'\n'.repeat(lines.length - 1)}${' '.repeat(
        lines[lines.length - 1].length
      )}{`
    }
    return `@media(_)${' '.repeat(p1.length + delta)}{`
  }
}

function createVirtualCssDocument(textDocument: TextDocument): TextDocument {
  return TextDocument.create(
    textDocument.uri,
    textDocument.languageId,
    0,
    textDocument
      .getText()
      .replace(/@screen(\s+[^{]+){/, replace(-2))
      .replace(/@variants(\s+[^{]+){/g, replace())
      .replace(/@responsive(\s*){/g, replace())
      .replace(/@layer(\s+[^{]{2,}){/g, replace(-3))
  )
}

async function validateTextDocument(textDocument: TextDocument): Promise<void> {
  textDocument = createVirtualCssDocument(textDocument)

  let settings = await getDocumentSettings(textDocument.uri)

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
        /Unknown at rule @(tailwind|apply)/.test(diagnostic.message)
      ) {
        return false
      }
      return true
    })

  connection.sendDiagnostics({ uri: textDocument.uri, diagnostics })
}

documents.listen(connection)
connection.listen()
