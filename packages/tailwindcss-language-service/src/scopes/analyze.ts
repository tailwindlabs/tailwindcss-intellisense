import type { TextDocument } from 'vscode-languageserver-textdocument'
import type { DocumentClassList, Span, State } from '../util/state'
import type {
  ScopeContext,
  ScopeAtRule,
  ScopeFn,
  ScopeClassList,
  ScopeClassName,
  ScopeAtImport,
  ScopeThemeOptionList,
} from './scope'
import { ScopeTree } from './tree'
import { getDocumentLanguages, LanguageBoundary } from '../util/getLanguageBoundaries'
import { findClassListsInRange, getClassNamesInClassList } from '../util/find'
import { segment } from '../util/segment'
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

    for await (let scope of analyzeClassLists(state, doc, boundary)) {
      root.children.push(scope)
    }

    let slice = doc.getText(boundary.range)
    for (let scope of analyzeAtRules(boundary, slice)) {
      root.children.push(scope)
    }

    for (let scope of analyzeHelperFns(boundary, slice)) {
      root.children.push(scope)
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

  // Emit generic scopes specific to certain at-rules
  if (name === '@utility') {
    let name = params
    let functional = false
    if (name.endsWith('-*')) {
      functional = true
      name = name.slice(0, -2)
    }

    scope.children.push({
      kind: 'css.at-rule.utility',
      children: [],
      meta: {
        kind: functional ? 'functional' : 'static',
      },
      source: {
        scope: overallSpan,
        name: [paramsSpan[0], paramsSpan[0] + name.length],
      },
    })
  }

  // `@import` statements are special
  else if (name === '@import') {
    let importScope: ScopeAtImport = {
      kind: 'css.at-rule.import',
      children: [],
      source: {
        scope: overallSpan,
        url: null,
        sourceUrl: null,
      },
    }

    scope.children.push(importScope)

    let start = 0

    for (let part of parts) {
      let offset = start
      let length = part.length + 1
      let type: string | null = null
      let quotable = true

      if (part.startsWith('url(')) {
        type = 'url'
        quotable = true
        part = part.slice(4)
        offset += 4

        if (part.endsWith(')')) {
          part = part.slice(0, -1)
        }
      }

      //
      else if (part.startsWith('source(')) {
        type = 'source-url'
        quotable = true
        part = part.slice(7)
        offset += 7

        if (part.endsWith(')')) {
          part = part.slice(0, -1)
        }
      }

      //
      else if (part.startsWith('theme(')) {
        type = 'theme-options'
        part = part.slice(6)
        offset += 6
        quotable = false

        if (part.endsWith(')')) {
          part = part.slice(0, -1)
        }
      }

      if (quotable && part.startsWith('"')) {
        type ??= 'url'
        part = part.slice(1)
        offset += 1

        if (part.endsWith('"')) {
          part = part.slice(0, -1)
        }
      }

      //
      else if (quotable && part.startsWith("'")) {
        type ??= 'url'
        part = part.slice(1)
        offset += 1

        if (part.endsWith("'")) {
          part = part.slice(0, -1)
        }
      }

      if (type === 'url') {
        importScope.source.url = [paramsSpan[0] + offset, paramsSpan[0] + offset + part.length]
      }

      //
      else if (type === 'source-url') {
        importScope.source.sourceUrl = [
          paramsSpan[0] + offset,
          paramsSpan[0] + offset + part.length,
        ]
      }

      //
      else if (type === 'theme-options') {
        let optionListScope: ScopeThemeOptionList = {
          kind: 'theme.option.list',
          children: [],
          source: {
            scope: [paramsSpan[0] + offset, paramsSpan[0] + offset + part.length],
          },
        }

        importScope.children.push(optionListScope)

        let options = segment(part, ' ')

        let start = offset

        for (let option of options) {
          let offset = start

          optionListScope.children.push({
            kind: 'theme.option.name',
            children: [],
            source: {
              scope: [paramsSpan[0] + offset, paramsSpan[0] + offset + option.length],
            },
          })

          start += option.length + 1
        }
      }

      start += length
    }
  }

  yield scope
}

const HELPER_FN = /(?<name>config|theme|--theme|--spacing|--alpha)\s*\(/dg

/**
 * Find all class lists and classes within the given block of text
 */
function* analyzeHelperFns(boundary: LanguageBoundary, slice: string): Iterable<ScopeFn> {
  if (boundary.type !== 'css') return

  // Look for helper functions in CSS
  for (let match of slice.matchAll(HELPER_FN)) {
    let groups = match.indices!.groups!

    let source: ScopeFn['source'] = {
      scope: [groups.name[0], groups.name[1]],
      name: [groups.name[0], groups.name[1]],
      params: [groups.name[1], groups.name[1]],
    }

    // Scan forward from each fn to find the end of the params
    let depth = 0
    for (let i = source.name[1]; i < slice.length; ++i) {
      if (depth === 0 && slice[i] === ';') {
        break
      } else if (slice[i] === '(') {
        depth += 1

        if (depth === 1) {
          source.params = [i + 1, i + 1]
        }
      } else if (slice[i] === ')') {
        depth -= 1

        if (depth === 0) {
          source.params[1] = i
          break
        }
      }
    }

    source.scope[1] = source.params[1] + 1

    yield {
      kind: 'css.fn',
      children: [],
      source,
    }
  }
}
