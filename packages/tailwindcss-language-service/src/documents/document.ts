import type { Position, TextDocument } from 'vscode-languageserver-textdocument'
import type { Span, State } from '../util/state'
import { ScopeTree } from '../scopes/tree'
import { ScopePath, walkScope } from '../scopes/walk'
import { ScopeContext } from '../scopes/scope'
import { LanguageBoundary } from '../util/getLanguageBoundaries'
import { isWithinRange } from '../util/isWithinRange'

export type DocumentContext = 'html' | 'css' | 'js' | 'other' | (string & {})

export class VirtualDocument {
  /**
   * A getter for the global state of the server. This state is shared across
   * all virtual documents and may change arbitrarily over time.
   *
   * This is a getter to prevent stale references from being held.
   */
  private state: () => State

  /**
   * The "text document" that contains the content of this document and all of
   * its embedded documents.
   */
  private storage: TextDocument

  /**
   * Conseptual boundaries of the document where different languages are used
   *
   * This is used to determine how the document is structured and what parts
   * are relevant to the current operation.
   */
  private boundaries: LanguageBoundary[]

  /**
   * A description of this document's "interesting" parts
   *
   * This is used to determine how the document is structured and what parts
   * are relevant to the current operation.
   *
   * For example, we can use this to get all class lists in a document, to
   * determine if the cursor is in a class name, or what part of a document is
   * considered "CSS" inside HTML or Vue documents.
   */
  private scopes: ScopeTree

  constructor(
    state: () => State,
    storage: TextDocument,
    boundaries: LanguageBoundary[],
    scopes: ScopeTree,
  ) {
    this.state = state
    this.storage = storage
    this.boundaries = boundaries
    this.scopes = scopes
  }

  /**
   * The current content of the document
   */
  public get contents() {
    let spans: Span[] = []

    walkScope(this.scopes.all(), {
      enter(node) {
        if (node.kind !== 'comment') return
        spans.push(node.source.scope)
      },
    })

    // TODO: Drop comment removal once all features only query scopes
    let text = this.storage.getText()

    // Replace all comment nodes with whitespace
    let tmp = ''
    let last = 0
    for (let [start, end] of spans) {
      tmp += text.slice(last, start)
      tmp += text.slice(start, end).replace(/./gs, (char) => (char === '\n' ? '\n' : ' '))
      last = end
    }

    tmp += text.slice(last)

    return tmp
  }

  /**
   * Find the inner-most scope containing a given cursor position.
   */
  public boundaryAt(cursor: Position): LanguageBoundary | null {
    for (let boundary of this.boundaries) {
      if (isWithinRange(cursor, boundary.range)) {
        return boundary
      }
    }

    return null
  }

  /**
   * Find the inner-most scope containing a given cursor position.
   */
  public scopeAt(cursor: Position): ScopePath {
    return this.scopes.at(this.storage.offsetAt(cursor))
  }

  /**
   * Find the inner-most scope containing a given cursor position.
   */
  public contextAt(cursor: Position): ScopeContext {
    let scope = this.scopes.closestAt('context', this.storage.offsetAt(cursor))
    if (!scope) throw new Error('Unreachable')

    return scope
  }
}
