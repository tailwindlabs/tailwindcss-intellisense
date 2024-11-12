import type { Position, Range, TextDocument } from 'vscode-languageserver-textdocument'
import type { State } from '../util/state'
import { isSemicolonlessCssLanguage } from '../util/languages'
import { uinteger } from 'vscode-languageserver'

export type DocumentContext = 'html' | 'css' | 'js' | 'other' | (string & {})

export class VirtualDocument {
  /**
   * A getter for the global state of the server. This state is shared across
   * all virtual documents and may change arbitrarily over time.

   * This is a getter to prevent stale references from being held.
   */
  private state: () => State

  /**
   * The "text document" that contains the content of this document and all of
   * its embedded documents.
   */
  private storage: TextDocument

  constructor(state: () => State, storage: TextDocument) {
    this.state = state
    this.storage = storage
  }

  /**
   * A high-level categorization of what kind of document this is and what kind
   * of language it uses. For example, HTML, Vue, and Svelte files all have a
   * kind of `html`, JS/TS/JSX/TS files have a kind of `js`, and CSS/SCSS/LESS
   * files have a kind of `css`.
   *
   * It's a generalization of "this document can be parsed roughly like this".
   */
  public kind: DocumentContext

  /**
   * The language ID that the document is using. This is a more specific
   * mapping of what a document is using.
   */
  public language: string

  /**
   * Where this document is located in the `storage` text document.
   *
   * This is an absolute location in the `storage` document and not relative to
   * the parent / embedding document if there is one.
   *
   * A value of `null` means that this document is the root document and refers
   * to the entire `storage` document.
   */
  public range: Range | null

  /**
   * Embedded content within this document that represents a distinct part of
   * the parent document. For example, a Vue file might have a `<template>`
   * block, a `<script>` block, and a `<style>` block each of which would be
   * represented as an embedded document.
   */
  public children: VirtualDocument[] = []

  /**
   * Whether or not this is an embedded document
   */
  public get isEmbedded() {
    return this.range !== null
  }

  /**
   * Whether or not the language of this document uses semicolons
   *
   * This is only relevant for CSS-style languages at the moment
   */
  public get languageUsesSemicolons(): boolean | null {
    if (this.kind !== 'css') return null

    return !isSemicolonlessCssLanguage(this.language, this.state().editor?.userLanguages)
  }

  /**
   * The current content of the document
   */
  public get contents() {
    return this.storage.getText(this.range ?? undefined)
  }

  /**
   * Whether the cursor is contained within this document
   *
   * This is always true for the root document
   */
  private contains(cursor: Position) {
    if (!this.range) return true

    return (
      this.range.start.line <= cursor.line &&
      cursor.line <= this.range.end.line &&
      this.range.start.character <= cursor.character &&
      cursor.character <= this.range.end.character
    )
  }

  /**
   * Find the inner-most document containing a given cursor position.
   *
   * No document may be returned if we're looking at an embedded document that
   * does not contain the cursor position.
   */
  public at(cursor: Position): VirtualDocument | null {
    for (let doc of this.children) {
      let found = doc.at(cursor)
      if (found) return found
    }

    return this.contains(cursor) ? this : null
  }

  /**
   * Find the inner-most document containing a given cursor position.
   *
   * No document may be returned if we're looking at an embedded document that
   * does not contain the cursor position.
   */
  public isContext(kind: DocumentContext) {
    return this.kind === kind
  }

  /**
   *  Create a temporary document that represents a subset of this document
   */
  public insetAt(cursor: Position, delta: number): VirtualDocument {
    let offset = this.storage.offsetAt(cursor)
    let startMin = this.range ? this.storage.offsetAt(this.range.start) : 0
    let endMax = this.range ? this.storage.offsetAt(this.range.end) : this.storage.getText().length

    let startPos = Math.max(startMin, offset + delta)
    let endPos = Math.min(endMax, offset - delta)

    return this.slice({
      start: this.storage.positionAt(startPos),
      end: this.storage.positionAt(endPos),
    })
  }

  private slice(range: Range) {
    let doc = new VirtualDocument(this.state, this.storage)
    doc.kind = this.kind
    doc.language = this.language
    doc.range = range
    return doc
  }
}

// doc.insetAt(cursor, -2000)

// doc.at(cursor).isContext('html')

// const positionOffset = doc.offsetAt(position)
// const searchRange: Range = {
//   start: doc.positionAt(Math.max(0, positionOffset - 2000)),
//   end: doc.positionAt(positionOffset + 2000),
// }
//
// let str = document.getText({
//   start: document.positionAt(Math.max(0, document.offsetAt(position) - 2000)),
//   end: position,
// })
