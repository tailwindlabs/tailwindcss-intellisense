import type { Position, TextDocument } from 'vscode-languageserver-textdocument'
import type { State } from '../util/state'
import { LanguageBoundary } from '../util/getLanguageBoundaries'
import { isWithinRange } from '../util/isWithinRange'
import { getTextWithoutComments } from '../util/doc'

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

  constructor(
    state: () => State,
    storage: TextDocument,
    boundaries: LanguageBoundary[],
  ) {
    this.state = state
    this.storage = storage
    this.boundaries = boundaries
  }

  /**
   * The current content of the document
   */
  public get contents() {
    // Replace all comment nodes with whitespace
    let tmp = ''

    let type = this.boundaries[0].type
    if (type === 'html') {
      tmp = getTextWithoutComments(this.storage, 'html')
    } else if (type === 'css') {
      tmp = getTextWithoutComments(this.storage, 'css')
    } else if (type === 'js') {
      tmp = getTextWithoutComments(this.storage, 'js')
    } else if (type === 'jsx') {
      tmp = getTextWithoutComments(this.storage, 'jsx')
    }

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
}
