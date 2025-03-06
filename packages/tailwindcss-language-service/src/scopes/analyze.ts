import type { TextDocument } from 'vscode-languageserver-textdocument'
import type { Span, State } from '../util/state'
import type {
  ScopeContext,
} from './scope'
import { ScopeTree } from './tree'
import { getDocumentLanguages, LanguageBoundary } from '../util/getLanguageBoundaries'
import { optimizeScopes } from './walk'
import { isSemicolonlessCssLanguage } from '../util/languages'

export async function analyzeDocument(state: State, doc: TextDocument): Promise<ScopeTree> {
  let roots: ScopeContext[] = []

  let boundaries = getDocumentLanguages(state, doc)

  for await (let root of analyzeBoundaries(state, doc, boundaries)) {
    roots.push(root)
  }

  // Turn sibling nodes into children
  // TODO: Remove the need for this
  // This is because we're using existing functions that analyze larger
  // blocks of text instead of smaller slices
  optimizeScopes(roots)

  return new ScopeTree(roots)
}

export async function* analyzeBoundaries(
  state: State,
  doc: TextDocument,
  boundaries: LanguageBoundary[],
): AsyncIterable<ScopeContext> {
  for (let boundary of boundaries) {
    let meta: ScopeContext['meta'] = {
      syntax: 'html',
      lang: 'html',
      semi: false,
    }

    let root: ScopeContext = {
      kind: 'context',
      children: [],
      meta,
      source: {
        scope: boundary.span,
      },
    }

    if (boundary.type === 'html') {
      meta.syntax = 'html'
      meta.lang = boundary.lang ?? 'html'
    } else if (boundary.type === 'js' || boundary.type === 'jsx') {
      meta.syntax = 'js'
      meta.lang = boundary.lang ?? 'js'
    } else if (boundary.type === 'css') {
      meta.syntax = 'css'
      meta.lang = boundary.lang ?? 'css'
      meta.semi = !isSemicolonlessCssLanguage(meta.lang)
    } else {
      meta.syntax = 'other'
      meta.lang = boundary.lang ?? boundary.type
    }

    yield root
  }
}
