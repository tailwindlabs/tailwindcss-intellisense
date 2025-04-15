import type { Position, TextDocument } from 'vscode-languageserver-textdocument'
import type {
  DocumentClassList,
  DocumentClassName,
  DocumentHelperFunction,
  Settings,
  State,
} from '../util/state'
import type { ServiceOptions } from '../service'
import { isWithinRange } from '../util/isWithinRange'
import { getDocumentBlocks, type LanguageBlock } from '../util/language-blocks'
import {
  findClassListsInCssRange,
  findClassListsInHtmlRange,
  findCustomClassLists,
  findHelperFunctionsInDocument,
  findHelperFunctionsInRange,
  getClassNamesInClassList,
} from '../util/find'
import { dedupeBySpan } from '../util/array'

export interface Document {
  readonly state: State
  readonly version: number
  readonly uri: string
  readonly settings: Settings
  readonly storage: TextDocument

  /**
   * Find the language block that contains the cursor
   */
  blockAt(cursor: Position): LanguageBlock | null

  /**
   * Find all class lists in the document
   */
  classLists(): Iterable<DocumentClassList>

  /**
   * Find all class lists at a given cursor position
   */
  classListsAt(cursor: Position): Iterable<DocumentClassList>

  /**
   * Find all class names in the document
   */
  classNames(): Iterable<DocumentClassName>

  /**
   * Find all class names at a given cursor position
   *
   * Theoretically, this function should only ever contain one entry
   * but the presence of custom regexes may produce multiple entries
   */
  classNamesAt(cursor: Position): Iterable<DocumentClassName>

  /**
   * Find all helper functions in the document
   *
   * This only applies to CSS contexts. Other document types will produce
   * zero entries.
   */
  helperFns(): Iterable<DocumentHelperFunction>

  /**
   * Find all helper functions at a given cursor position
   */
  helperFnsAt(cursor: Position): Iterable<DocumentHelperFunction>
}

export async function createVirtualDocument(
  opts: ServiceOptions,
  storage: TextDocument,
): Promise<Document> {
  /**
   * The state of the server at the time of creation
   */
  let state = opts.state()

  /**
   * The current settings for this document
   */
  let settings = await state.editor.getConfiguration(storage.uri)

  /**
   * Conceptual boundaries of the document where different languages are used
   *
   * This is used to determine how the document is structured and what parts
   * are relevant to the current operation.
   */
  let blocks = getDocumentBlocks(state, storage)

  /**
   * All class lists in the document
   */
  let classLists: DocumentClassList[] = []

  for (let block of blocks) {
    if (block.context === 'css') {
      classLists.push(...findClassListsInCssRange(state, storage, block.range, block.lang))
    } else if (block.context === 'html') {
      classLists.push(...(await findClassListsInHtmlRange(state, storage, 'html', block.range)))
    } else if (block.context === 'js') {
      classLists.push(...(await findClassListsInHtmlRange(state, storage, 'jsx', block.range)))
    }
  }

  classLists.push(...(await findCustomClassLists(state, storage)))

  classLists.sort((a, b) => a.span[0] - b.span[0] || b.span[1] - a.span[1])
  classLists = dedupeBySpan(classLists)

  /**
   * All class names in the document
   */
  let classNames: DocumentClassName[] = []

  for (let classList of classLists) {
    classNames.push(...getClassNamesInClassList(classList, state.blocklist ?? []))
  }

  classNames.sort((a, b) => a.span[0] - b.span[0] || b.span[1] - a.span[1])
  classNames = dedupeBySpan(classNames)

  /**
   * Helper functions in CSS
   */
  let helperFns: DocumentHelperFunction[] = []

  for (let block of blocks) {
    if (block.context === 'css') {
      helperFns.push(...findHelperFunctionsInRange(storage, block.range))
    }
  }

  function blockAt(cursor: Position): LanguageBlock | null {
    for (let block of blocks) {
      if (isWithinRange(cursor, block.range)) {
        return block
      }
    }

    return null
  }

  /**
   * Find all class lists at a given cursor position
   */
  function classListsAt(cursor: Position): DocumentClassList[] {
    return classLists.filter((classList) => isWithinRange(cursor, classList.range))
  }

  /**
   * Find all class names at a given cursor position
   */
  function classNamesAt(cursor: Position): DocumentClassName[] {
    return classNames.filter((className) => isWithinRange(cursor, className.range))
  }

  /**
   * Find all class names at a given cursor position
   */
  function helperFnsAt(cursor: Position): DocumentHelperFunction[] {
    return helperFns.filter((fn) => isWithinRange(cursor, fn.ranges.full))
  }

  return {
    settings,
    storage,
    uri: storage.uri,

    get version() {
      return storage.version
    },

    get state() {
      return opts.state()
    },

    blockAt,

    classLists: () => classLists.slice(),
    classListsAt,
    classNames: () => classNames.slice(),
    classNamesAt,

    helperFns: () => helperFns.slice(),
    helperFnsAt,
  }
}
