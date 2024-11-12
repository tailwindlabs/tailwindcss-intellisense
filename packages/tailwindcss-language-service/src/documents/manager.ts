import type { TextDocument } from 'vscode-languageserver-textdocument'
import type { State } from '../util/state'
import { VirtualDocument } from './document'
import { getLanguageBoundaries, LanguageBoundary } from '../util/getLanguageBoundaries'
import { isCssLanguage } from '../util/css'
import { isJsDoc } from '../util/js'
import { isHtmlDoc, isSvelteDoc, isVueDoc } from '../util/html'
import { uinteger } from 'vscode-languageserver'

export class DocumentManager {
  /**
   * A getter for the global state of the server. This state is shared across
   * all virtual documents and may change arbitrarily over time.

   * This is a getter to prevent stale references from being held.
   */
  private state: () => State

  /**
   * A map of document URIs to their respective virtual documents.
   *
   * This also includes embedded documents. Embedded documents have fragments
   * appended to their URIs to differentiate them from the parent document.
   */
  private store = new Map<string, VirtualDocument>()

  constructor(state: () => State) {
    this.state = state
  }

  get(uri: TextDocument): VirtualDocument
  get(uri: string): VirtualDocument | null

  get(doc: TextDocument | string): VirtualDocument | null {
    if (typeof doc === 'string') {
      return this.store.get(doc) ?? null
    }

    let found = this.store.get(doc.uri)
    if (!found) {
      found = this.build(doc)
      this.store.set(doc.uri, found)
    }

    return found
  }

  private build(text: TextDocument): VirtualDocument {
    let state = this.state()

    let boundary: LanguageBoundary = {
      range: {
        start: { line: 0, character: 0 },
        end: { line: uinteger.MAX_VALUE, character: uinteger.MAX_VALUE },
      },
      type: 'root',
      lang: text.languageId,
    }

    if (isCssLanguage(state, text.languageId)) {
      boundary.type = 'css'
    } else if (isJsDoc(state, text)) {
      boundary.type = 'js'
    } else if (isHtmlDoc(state, text)) {
      boundary.type = 'html'
    } else if (isVueDoc(text)) {
      boundary.type = 'html'
    } else if (isSvelteDoc(text)) {
      boundary.type = 'html'
    }

    let root = this.create(text, boundary)

    let boundaries = getLanguageBoundaries(state, text) ?? []

    for (let [idx, boundary] of boundaries.entries()) {
      root.children.push(this.create(text, boundary, `#${idx}`))
    }

    return root
  }

  private create(text: TextDocument, boundary: LanguageBoundary, id?: string): VirtualDocument {
    // This is the "root" document representing the entire file
    let doc = new VirtualDocument(this.state, text)

    doc.range = boundary.range
    doc.language = boundary.lang!
    doc.kind = boundary.type as any

    let uri = text.uri + (id ?? '')

    this.store.set(uri, doc)

    return doc
  }
}
