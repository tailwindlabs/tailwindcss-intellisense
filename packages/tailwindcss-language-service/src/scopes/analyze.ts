import type { TextDocument } from 'vscode-languageserver-textdocument'
import type { Span, State } from '../util/state'
import { type Scope, Scopes } from './scope'
import { getLanguageBoundaries, LanguageBoundary } from '../util/getLanguageBoundaries'
import { findClassNamesInRange } from '../util/find'
import { segment } from '../util/segment'

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
    let slice = doc.getText(boundary.range)

    for await (let scope of analyzeContexts(state, doc, boundary)) {
      scopes.push(scope)
    }

    for (let scope of analyzeAtRules(boundary, slice)) {
      scopes.push(scope)
    }

    for (let scope of analyzeHelperFns(boundary, slice)) {
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

const AT_RULE = /(?<name>@[a-z-]+)\s*(?<params>[^;{]*)(?:[;{]|$)/dg

interface AtRuleDescriptor {
  name: Span
  params: Span
  body: Span | null
}

/**
 * Find all class lists and classes within the given block of text
 */
function* analyzeAtRules(boundary: LanguageBoundary, slice: string): Iterable<Scope> {
  if (boundary.type !== 'css') return

  let rules: AtRuleDescriptor[] = []

  // Look for at-rules like `@apply` and `@screen`
  // These _may not be complete_ but that's okay
  // We just want to know that they're there and where they are
  for (let match of slice.matchAll(AT_RULE)) {
    let rule: AtRuleDescriptor = {
      name: match.indices.groups.name,
      params: match.indices.groups.params,
      body: null,
    }

    rule.name[0] += boundary.span[0]
    rule.name[1] += boundary.span[0]

    rule.params[0] += boundary.span[0]
    rule.params[1] += boundary.span[0]

    rules.push(rule)
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
          rule.body[1] = i
          break
        }
      }
    }

    for (let scope of analyzeAtRule(slice, rule)) {
      yield scope
    }
  }
}

function* analyzeAtRule(slice: string, desc: AtRuleDescriptor): Iterable<Scope> {
  let name = slice.slice(desc.name[0], desc.name[1])
  let params = slice.slice(desc.params[0], desc.params[1]).trim()
  let parts = segment(params, ' ')

  let body = desc.body ? slice.slice(desc.body[0], desc.body[1]) : null

  // Emit generic at-rule scopes
  yield {
    kind: 'css.at-rule.name',
    span: desc.name,
  }

  yield {
    kind: 'css.at-rule.params',
    span: desc.params,
  }

  if (body) {
    yield {
      kind: 'css.at-rule.body',
      span: desc.body,
    }
  }

  // Emit generic scopes specific to certain at-rules
  if (name === '@utility') {
    let name = params
    let functional = false
    if (name.endsWith('-*')) {
      functional = true
      name = name.slice(0, -2)
    }

    yield {
      kind: 'css.utility.name',
      span: [desc.params[0], desc.params[0] + name.length],
    }

    if (body) {
      yield {
        kind: functional ? 'css.utility.functional' : 'css.utility.static',
        span: desc.body,
      }
    }
  }

  // `@import` statements are special
  else if (name === '@import') {
    let start = 0

    for (let part of parts) {
      let offset = start
      let length = part.length + 1
      let type = null
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
        yield {
          kind: 'css.import.url',
          span: [desc.params[0] + offset, desc.params[0] + offset + part.length],
        }
      }

      //
      else if (type === 'source-url') {
        yield {
          kind: 'css.import.source-url',
          span: [desc.params[0] + offset, desc.params[0] + offset + part.length],
        }
      }

      //
      else if (type === 'theme-options') {
        yield {
          kind: 'css.import.theme-option-list',
          span: [desc.params[0] + offset, desc.params[0] + offset + part.length],
        }

        let options = segment(part, ' ')

        let start = offset

        for (let option of options) {
          let offset = start

          yield {
            kind: 'css.import.theme-option',
            span: [desc.params[0] + offset, desc.params[0] + offset + option.length],
          }

          start += option.length + 1
        }
      }

      start += length
    }
  }
}

const HELPER_FN = /(?<name>config|theme|--theme|--spacing|--alpha)\s*\(/dg

interface HelperFnDescriptor {
  name: Span
  params: Span
}

/**
 * Find all class lists and classes within the given block of text
 */
function* analyzeHelperFns(boundary: LanguageBoundary, slice: string): Iterable<Scope> {
  if (boundary.type !== 'css') return

  let fns: HelperFnDescriptor[] = []

  // Look for helper functions in CSS
  for (let match of slice.matchAll(HELPER_FN)) {
    let fn: HelperFnDescriptor = {
      name: match.indices.groups.name,
      params: [match.indices.groups.name[1], match.indices.groups.name[1]],
    }

    fn.name[0] += boundary.span[0]
    fn.name[1] += boundary.span[0]

    fn.params[0] += boundary.span[0]
    fn.params[1] += boundary.span[0]

    // Scan forward from each fn to find the end of the params
    let depth = 0
    for (let i = fn.name[1]; i < slice.length; ++i) {
      if (depth === 0 && slice[i] === ';') {
        break
      } else if (slice[i] === '(') {
        depth += 1

        if (depth === 1) {
          fn.params = [i + 1, i + 1]
        }
      } else if (slice[i] === ')') {
        depth -= 1

        if (depth === 0) {
          fn.params[1] = i
          break
        }
      }
    }

    fns.push(fn)
  }

  for (let fn of fns) {
    for (let scope of analyzeHelperFn(slice, fn)) {
      yield scope
    }
  }
}

function* analyzeHelperFn(slice: string, desc: HelperFnDescriptor): Iterable<Scope> {
  // Emit generic scopes
  yield {
    kind: 'css.fn.name',
    span: desc.name,
  }

  yield {
    kind: 'css.fn.params',
    span: desc.params,
  }
}
