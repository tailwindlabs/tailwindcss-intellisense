import type { TextDocument } from 'vscode-languageserver-textdocument'
import type { DocumentClassList, Span, State } from '../util/state'
import type {
  ScopeContext,
  ScopeAtRule,
  ScopeClassList,
  ScopeClassName,
} from './scope'
import { ScopeTree } from './tree'
import { getDocumentLanguages, LanguageBoundary } from '../util/getLanguageBoundaries'
import { findClassListsInRange, getClassNamesInClassList } from '../util/find'
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

/**
 * Find all class lists and classes within the given block of text
 */
async function* analyzeClassLists(
  state: State,
  doc: TextDocument,
  boundary: LanguageBoundary,
): AsyncIterable<ScopeClassList | ScopeClassName> {
  let classLists: DocumentClassList[] = []

  if (boundary.type === 'html') {
    classLists = await findClassListsInRange(state, doc, boundary.range, 'html')
  } else if (boundary.type === 'js') {
    classLists = await findClassListsInRange(state, doc, boundary.range, 'jsx')
  } else if (boundary.type === 'jsx') {
    classLists = await findClassListsInRange(state, doc, boundary.range, 'jsx')
  } else if (boundary.type === 'css') {
    classLists = await findClassListsInRange(state, doc, boundary.range, 'css')
  }

  for (let classList of classLists) {
    let listScope: ScopeClassList = {
      kind: 'class.list',
      children: [],
      source: { scope: classList.span },
    }

    let classNames = getClassNamesInClassList(classList, state.blocklist)

    for (let className of classNames) {
      listScope.children.push({
        kind: 'class.name',
        children: [],
        source: { scope: className.span },
      })
    }

    yield listScope
  }
}

const AT_RULE = /(?<name>@[a-z-]+)\s*(?<params>[^;{]*)(?:[;{]|$)/dg

interface AtRuleDescriptor {
  name: Span
  params: Span
  body: Span | null
}

/**
 * Find all class lists and classes within the given block of text
 */
function* analyzeAtRules(boundary: LanguageBoundary, slice: string): Iterable<ScopeAtRule> {
  if (boundary.type !== 'css') return

  let rules: AtRuleDescriptor[] = []

  // Look for at-rules like `@apply` and `@screen`
  // These _may not be complete_ but that's okay
  // We just want to know that they're there and where they are
  for (let match of slice.matchAll(AT_RULE)) {
    rules.push({
      name: match.indices!.groups!.name,
      params: match.indices!.groups!.params,
      body: null,
    })
  }

  for (let rule of rules) {
    // Scan forward from each at-rule to find the body
    // This is a bit naive but it's good enough for now
    let depth = 0
    for (let i = rule.params[1]; i < slice.length; ++i) {
      if (depth === 0 && slice[i] === ';') {
        break
      }

      //
      else if (slice[i] === '{') {
        depth += 1

        if (depth === 1) {
          rule.body = [i, i]
        }
      }

      //
      else if (slice[i] === '}') {
        depth -= 1

        if (depth === 0) {
          rule.body![1] = i
          break
        }
      }
    }

    for (let scope of analyzeAtRule(boundary, slice, rule)) {
      yield scope
    }
  }
}

function* analyzeAtRule(
  boundary: LanguageBoundary,
  slice: string,
  desc: AtRuleDescriptor,
): Iterable<ScopeAtRule> {
  let name = slice.slice(desc.name[0], desc.name[1])
  let params = slice.slice(desc.params[0], desc.params[1]).trim()
  let parts = segment(params, ' ')

  // Offset spans so they're document-relative
  let offset = boundary.span[0]
  let overallSpan: Span = [desc.name[0], desc.body ? desc.body[1] : desc.params[1]]
  let nameSpan: Span = [desc.name[0], desc.name[1]]
  let paramsSpan: Span = [desc.params[0], desc.params[1]]
  let bodySpan: Span | null = desc.body ? [desc.body[0], desc.body[1]] : null

  overallSpan[0] += offset
  overallSpan[1] += offset
  nameSpan[0] += offset
  nameSpan[1] += offset
  paramsSpan[0] += offset
  paramsSpan[1] += offset

  if (bodySpan) {
    bodySpan[0] += offset
    bodySpan[1] += offset
  }

  let scope: ScopeAtRule = {
    kind: 'css.at-rule',
    children: [],

    source: {
      scope: overallSpan,
      name: nameSpan,
      params: paramsSpan,
      body: bodySpan,
    },
  }

  yield scope
}
