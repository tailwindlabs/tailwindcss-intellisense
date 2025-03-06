import type { TextDocument } from 'vscode-languageserver-textdocument'
import type { State } from '../util/state'
import { VirtualDocument } from './document'
import { analyzeDocument } from '../scopes/analyze'
import { getDocumentLanguages, getLanguageBoundaries } from '../util/getLanguageBoundaries'

export class DocumentManager {
  /**
   * A getter for the global state of the server. This state is shared across
   * all virtual documents and may change arbitrarily over time.

   * This is a getter to prevent stale references from being held.
   */
  private state: () => State

  /**
   * A map of document URIs to their respective virtual documents.
   */
  private store = new Map<string, VirtualDocument>()

  constructor(state: () => State) {
    this.state = state
  }

  get(uri: TextDocument): Promise<VirtualDocument>
  get(uri: string): Promise<VirtualDocument | null>

  async get(doc: TextDocument | string): Promise<VirtualDocument | null> {
    if (typeof doc === 'string') {
      return this.store.get(doc) ?? null
    }

    let found = this.store.get(doc.uri)
    if (found) return found

    let state = this.state()
    let scopes = await analyzeDocument(state, doc)
    let boundaries = getDocumentLanguages(state, doc)
    found = new VirtualDocument(this.state, doc, boundaries, scopes)
    this.store.set(doc.uri, found)

    return found
  }
}
