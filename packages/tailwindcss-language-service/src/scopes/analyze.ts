import type { TextDocument } from 'vscode-languageserver-textdocument'
import type { State } from '../util/state'
import { type Scope, Scopes } from './scope'
import { getLanguageBoundaries, LanguageBoundary } from '../util/getLanguageBoundaries'
import { findClassNamesInRange } from '../util/find'

export async function analyzeDocument(state: State, doc: TextDocument): Promise<Scopes> {
  let scopes: Scope[] = []

  let boundaries = getLanguageBoundaries(state, doc)
  if (boundaries === null) {
    boundaries = [
      {
        type: doc.languageId,
        span: [0, doc.getText().length],
        range: { start: doc.positionAt(0), end: doc.positionAt(doc.getText().length) },
      },
    ]
  }

  for (let boundary of boundaries) {
    for await (let scope of analyzeContexts(state, doc, boundary)) {
      scopes.push(scope)
    }

    for await (let scope of analyzeClassLists(state, doc, boundary)) {
      scopes.push(scope)
    }
  }

  return new Scopes(scopes)
}

/**
 * Figure out what kind of text we're looking at
 */
async function* analyzeContexts(
  state: State,
  doc: TextDocument,
  boundary: LanguageBoundary,
): AsyncIterable<Scope> {
  if (boundary.type === 'html') {
    yield {
      kind: 'context.html',
      span: boundary.span,
    }
  }

  if (boundary.type === 'js' || boundary.type === 'jsx') {
    yield {
      kind: 'context.js',
      span: boundary.span,
    }
  }

  if (boundary.type === 'css') {
    yield {
      kind: 'context.css',
      span: boundary.span,
    }
  }
}

/**
 * Find all class lists and classes within the given block of text
 */
async function* analyzeClassLists(
  state: State,
  doc: TextDocument,
  boundary: LanguageBoundary,
): AsyncIterable<Scope> {
  if (
    boundary.type !== 'html' &&
    boundary.type !== 'js' &&
    boundary.type !== 'jsx' &&
    boundary.type !== 'css'
  ) {
    return
  }

  let mode = boundary.type === 'js' ? 'jsx' : (boundary.type as 'html' | 'jsx' | 'css')

  let classNames = await findClassNamesInRange(state, doc, boundary.range, mode)
  let seenClassLists = new Set<string>()

  for (let className of classNames) {
    // TODO: Figure out why the classList objects are duplicated
    let classList = className.classList
    let key = classList.span.join(':')

    if (!seenClassLists.has(key)) {
      seenClassLists.add(key)
      yield {
        kind: 'class.list',
        span: className.classList.span,
      }
    }

    yield {
      kind: 'class.name',
      span: className.span,
    }
  }
}
