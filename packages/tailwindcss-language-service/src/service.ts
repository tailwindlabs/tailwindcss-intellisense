import type { Position, Range, TextDocument } from 'vscode-languageserver-textdocument'
import {
  type Color,
  type CodeAction,
  type CodeActionContext,
  type CodeActionParams,
  type CodeLens,
  type ColorInformation,
  type CompletionContext,
  type CompletionItem,
  type CompletionList,
  type DocumentLink,
  type Hover,
  type ColorPresentation,
  type DocumentDiagnosticReport,
} from 'vscode-languageserver'
import type { State } from './util/state'
import type { DiagnosticKind } from './diagnostics/types'
import type { FileSystem } from './fs'
import picomatch from 'picomatch'
import { doHover } from './hoverProvider'
import { getDocumentLinks } from './documentLinksProvider'
import { getDocumentColors } from './documentColorProvider'
import { getCodeLens } from './codeLensProvider'
import { doComplete, resolveCompletionItem, completionsFromClassList } from './completionProvider'
import { doValidate } from './diagnostics/diagnosticsProvider'
import { doCodeActions } from './codeActions/codeActionProvider'
import { provideColorPresentation } from './colorPresentationProvider'
import { getColor, KeywordColor } from './util/color'
import * as culori from 'culori'
import { Document } from './documents/document'
import { createDocumentStore } from './documents/store'

export interface ServiceOptions {
  fs: FileSystem
  state: () => State
}

export interface LanguageDocument {
  hover(position: Position): Promise<Hover | null>
  colorPresentation(color: Color, range: Range): Promise<ColorPresentation[]>
  documentLinks(): Promise<DocumentLink[]>
  documentColors(): Promise<ColorInformation[]>
  codeLenses(): Promise<CodeLens[]>
  diagnostics(kinds?: DiagnosticKind[]): Promise<DocumentDiagnosticReport>
  codeActions(range: Range, context: CodeActionContext): Promise<CodeAction[]>
  completions(position: Position, ctx?: CompletionContext): Promise<CompletionList | null>
  resolveCompletion(item: CompletionItem): Promise<CompletionItem>
}

export interface LanguageService {
  open(doc: TextDocument | string): Promise<LanguageDocument | null>
  resolveCompletion(item: CompletionItem): Promise<CompletionItem>
  onUpdateSettings(): Promise<void>

  /** @internal */
  getColor(className: string): Promise<culori.Color | KeywordColor | null>

  /** @internal */
  completionsFromClassList(classList: string, range: Range): Promise<CompletionList | null>
}

export function createLanguageService(opts: ServiceOptions): LanguageService {
  let store = createDocumentStore(opts)

  async function open(doc: TextDocument | string) {
    return createLanguageDocument(opts, await store.parse(doc))
  }

  return {
    open,
    async getColor(className: string) {
      return getColor(opts.state(), className)
    },
    async completionsFromClassList(classList: string, range: Range) {
      return completionsFromClassList(opts.state(), classList, range, 16)
    },
    async resolveCompletion(item: CompletionItem) {
      // Figure out what document this completion item belongs to
      let uri = item.data?.uri
      if (!uri) return Promise.resolve(item)

      let textDoc = await opts.fs.document(uri)
      if (!textDoc) return Promise.resolve(item)

      let doc = await open(textDoc)

      return doc.resolveCompletion(item)
    },

    async onUpdateSettings() {
      store.clear()
    },
  }
}

async function createLanguageDocument(
  opts: ServiceOptions,
  doc: Document,
): Promise<LanguageDocument | null> {
  let state = opts.state()
  if (!state.enabled) return null
  if (!state.editor) throw new Error('No editor provided')

  state.editor.readDirectory = async (doc, filepath) => {
    let files = await opts.fs.readDirectory(doc, filepath)

    return files.map((file) => [file.name, { isDirectory: file.type === 'directory' }])
  }

  // Get the settings for the current document
  let settings = await state.editor.getConfiguration(doc.uri)
  if (!settings) throw new Error('Unable to get the settings for the current document')

  // Should we ignore this file?
  let exclusions = settings.tailwindCSS.files.exclude.map((pattern) => {
    return picomatch(`${state.editor.folder}/${pattern}`)
  })

  for (let isExcluded of exclusions) {
    if (isExcluded(doc.uri)) return null
  }

  return {
    async hover(position: Position) {
      if (!state.enabled || !settings.tailwindCSS.hovers) return null

      return doHover(doc, position)
    },

    async documentLinks() {
      if (!state.enabled) return []

      return getDocumentLinks(state, doc.storage, (path) => {
        return opts.fs.resolve(doc.storage, path)
      })
    },

    async documentColors() {
      if (!state.enabled || !settings.tailwindCSS.colorDecorators) return []

      return getDocumentColors(doc)
    },

    async colorPresentation(color: Color, range: Range) {
      if (!state.enabled || !settings.tailwindCSS.colorDecorators) return []

      return provideColorPresentation(state, doc.storage, color, range)
    },

    async codeLenses() {
      if (!state.enabled || !settings.tailwindCSS.codeLens) return []

      return getCodeLens(state, doc.storage)
    },

    async diagnostics(kinds?: DiagnosticKind[]) {
      if (!state.enabled || !settings.tailwindCSS.validate) {
        return {
          kind: 'full',
          items: [],
        }
      }

      return doValidate(state, doc.storage, kinds)
    },

    async codeActions(range: Range, context: CodeActionContext) {
      if (!state.enabled || !settings.tailwindCSS.codeActions) return []

      let params: CodeActionParams = {
        textDocument: { uri: doc.uri },
        range,
        context,
      }

      return doCodeActions(state, params, doc.storage)
    },

    async completions(position: Position, ctx?: CompletionContext) {
      if (!state.enabled || !settings.tailwindCSS.suggestions) return null

      state.completionItemData.uri = doc.uri
      return doComplete(state, doc.storage, position, ctx)
    },

    async resolveCompletion(item: CompletionItem) {
      if (!state.enabled || !settings.tailwindCSS.suggestions) return item

      return resolveCompletionItem(state, item)
    },
  }
}
