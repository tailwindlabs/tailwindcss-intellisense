import { type Range, type Position, LRUCache } from 'vscode-languageserver'
import type { TextDocument } from 'vscode-languageserver-textdocument'
import type {
  DocumentClassName,
  DocumentClassList,
  State,
  DocumentHelperFunction,
  Settings,
} from './state'
import lineColumn from 'line-column'
import { isCssDoc } from './css'
import { isWithinRange } from './isWithinRange'
import { dedupeByRange, flatten } from './array'
import { getClassAttributeLexer, getComputedClassAttributeLexer } from './lexers'
import { getLanguageBoundaries } from './getLanguageBoundaries'
import { absoluteRange } from './absoluteRange'
import { getTextWithoutComments } from './doc'
import { isSemicolonlessCssLanguage } from './languages'
import { customClassesIn } from './classes'

export function findAll(re: RegExp, str: string): RegExpMatchArray[] {
  let match: RegExpMatchArray
  let matches: RegExpMatchArray[] = []
  while ((match = re.exec(str)) !== null) {
    matches.push({ ...match })
  }
  return matches
}

export function findLast(re: RegExp, str: string): RegExpMatchArray {
  const matches = findAll(re, str)
  if (matches.length === 0) {
    return null
  }
  return matches[matches.length - 1]
}

const BY_ASCII_WHITESPACE = /([\t\n\f\r ]+)/

/**
 * Extract class names from a list separated by whitespace
 *
 * The HTML spec separates classes by ASCII whitespace:
 * - U+0009 TAB
 * - U+000A LF
 * - U+000C FF
 * - U+000D CR
 * - U+0020 SPACE
 *
 * The CSS spec also effectively uses the above definition for whitespace.
 *
 * @see {@link https://dom.spec.whatwg.org/#concept-getelementsbyclassname}
 * @see {@link https://dom.spec.whatwg.org/#concept-ordered-set-parser}
 * @see {@link https://infra.spec.whatwg.org/#ascii-whitespace}
 * @see {@link https://www.w3.org/TR/css-syntax-3/#whitespace}
 */
export function getClassNamesInClassList(
  classList: DocumentClassList,
  blocklist: State['blocklist'],
): DocumentClassName[] {
  let input = classList.classList
  let parts = input.split(BY_ASCII_WHITESPACE)
  let names: DocumentClassName[] = []
  let index = 0

  for (let i = 0; i < parts.length; i++) {
    let isWhitespace = i % 2 === 1
    let className = parts[i]

    let start = index
    let end = start + className.length
    index += className.length

    if (isWhitespace) continue
    if (blocklist.includes(className)) continue

    let relativeRange = {
      start: indexToPosition(input, start),
      end: indexToPosition(input, end),
    }

    let range = absoluteRange(relativeRange, classList.range)

    names.push({
      className,
      classList,
      relativeRange,
      range,
    })
  }

  return names
}

function findClassListsInCssRange(
  state: State,
  doc: TextDocument,
  range?: Range,
  lang?: string,
): DocumentClassList[] {
  const text = getTextWithoutComments(doc, 'css', range)
  let regex = isSemicolonlessCssLanguage(lang ?? doc.languageId, state.editor?.userLanguages)
    ? /(@apply\s+)(?<classList>[^}\r\n]+?)(?<important>\s*!important)?(?:\r|\n|}|$)/g
    : /(@apply\s+)(?<classList>[^;}]+?)(?<important>\s*!important)?\s*[;}]/g
  const matches = findAll(regex, text)
  const globalStart: Position = range ? range.start : { line: 0, character: 0 }

  return matches.map((match) => {
    const start = indexToPosition(text, match.index + match[1].length)
    const end = indexToPosition(text, match.index + match[1].length + match.groups.classList.length)
    const range = absoluteRange({ start, end }, { start: globalStart, end: globalStart })
    return {
      classList: match.groups.classList,
      important: Boolean(match.groups.important),
      range,
    }
  })
}

function findCustomClassLists(doc: TextDocument, settings: Settings): DocumentClassList[] {
  let regexes = settings.tailwindCSS.experimental.classRegex
  if (!Array.isArray(regexes) || regexes.length === 0) {
    return []
  }

  let text = doc.getText()
  let result: DocumentClassList[] = []

  try {
    for (let match of customClassesIn({ text, filters: regexes })) {
      result.push({
        classList: match.classList,
        range: {
          start: doc.positionAt(match.range[0]),
          end: doc.positionAt(match.range[1]),
        },
      })
    }
  } catch (err) {
    console.error(err)
    console.log({ text, filters: regexes })
    throw new Error('Failed to parse custom class regex')
  }

  return result
}

export function matchClassAttributes(text: string, attributes: string[]): RegExpMatchArray[] {
  const attrs = attributes.filter((x) => typeof x === 'string').flatMap((a) => [a, `\\[${a}\\]`])
  const re = /(?:\s|:|\()(ATTRS)\s*=\s*['"`{]/
  return findAll(new RegExp(re.source.replace('ATTRS', attrs.join('|')), 'gi'), text)
}

export function matchClassFunctions(text: string, fnNames: string[]): RegExpMatchArray[] {
  // 1. Validate the list of function name patterns provided by the user
  let names = fnNames.filter((x) => typeof x === 'string')
  if (names.length === 0) return []

  // 2. Extract function names in the document
  // This is intentionally scoped to JS syntax for now but should be extended to
  // other languages in the future
  //
  // This regex the JS pattern for an identifier + function call with some
  // additional constraints:
  //
  // - It needs to be in an expression position — so it must be preceded by
  // whitespace, parens, curlies, commas, whitespace, etc…
  // - It must look like a fn call or a tagged template literal
  let FN_NAMES = /(?<=^|[:=,;\s{()\[])([\p{ID_Start}$_][\p{ID_Continue}$_.]*)[(`]/dgiu
  let foundFns = findAll(FN_NAMES, text)

  // 3. Match against the function names in the document
  let re = /^(NAMES)$/
  let isClassFn = new RegExp(re.source.replace('NAMES', names.join('|')), 'i')

  let matches = foundFns.filter((fn) => isClassFn.test(fn[1]))

  return matches
}

function findClassListsInHtmlRange(
  doc: TextDocument,
  type: 'html' | 'js',
  range: Range,
  settings: Settings,
): DocumentClassList[] {
  let text = getTextWithoutComments(doc, type, range)
  let matches = matchClassAttributes(text, settings.tailwindCSS.classAttributes)

  // For JS/TS contexts we want to look inside specific function calls and
  // tagged template literals for class lists
  let fnNames = settings.tailwindCSS.classFunctions ?? []
  if (type === 'js' && fnNames.length) {
    matches.push(...matchClassFunctions(text, fnNames))
  }

  const existingResultSet = new Set<string>()
  const results: DocumentClassList[] = []

  matches.sort((a, b) => a.index - b.index)

  matches.forEach((match) => {
    const subtext = text.substr(match.index + match[0].length - 1)

    let lexer =
      match[0][0] === ':' || (match[1].startsWith('[') && match[1].endsWith(']'))
        ? getComputedClassAttributeLexer()
        : getClassAttributeLexer()
    lexer.reset(subtext)

    let classLists: { value: string; offset: number }[] = []
    let currentClassList: { value: string; offset: number }

    try {
      for (let token of lexer) {
        if (token.type === 'classlist' || token.type.startsWith('arb')) {
          if (currentClassList) {
            currentClassList.value += token.value
          } else {
            currentClassList = {
              value: token.value,
              offset: token.offset,
            }
          }
        } else {
          if (currentClassList) {
            classLists.push({
              value: currentClassList.value,
              offset: currentClassList.offset,
            })
          }
          currentClassList = undefined
        }
      }
    } catch (_) {}

    if (currentClassList) {
      classLists.push({
        value: currentClassList.value,
        offset: currentClassList.offset,
      })
    }

    classLists.forEach(({ value, offset }) => {
      if (value.trim() === '') {
        return null
      }

      const before = value.match(/^\s*/)
      const beforeOffset = before === null ? 0 : before[0].length
      const after = value.match(/\s*$/)
      const afterOffset = after === null ? 0 : -after[0].length

      const start = indexToPosition(text, match.index + match[0].length - 1 + offset + beforeOffset)
      const end = indexToPosition(
        text,
        match.index + match[0].length - 1 + offset + value.length + afterOffset,
      )
      const resultRange = absoluteRange({ start, end }, range)

      const result: DocumentClassList = {
        classList: value.substr(beforeOffset, value.length + afterOffset),
        range: resultRange,
      }

      const resultKey = [
        result.classList,
        result.range.start.line,
        result.range.start.character,
        result.range.end.line,
        result.range.end.character,
      ].join(':')

      // No need to add the result if it was already matched
      if (!existingResultSet.has(resultKey)) {
        existingResultSet.add(resultKey)
        results.push(result)
      }
    })
  })

  return results
}

export async function findClassListsInDocument(
  state: State,
  doc: TextDocument,
): Promise<DocumentClassList[]> {
  if (isCssDoc(state, doc)) {
    return findClassListsInCssRange(state, doc)
  }

  let settings = await state.editor.getConfiguration(doc.uri)

  let classLists: DocumentClassList[] = []

  let boundaries = getLanguageBoundaries(state, doc)
  if (!boundaries) return []

  for (let b of boundaries) {
    if (b.type === 'html') {
      classLists.push(...findClassListsInHtmlRange(doc, 'html', b.range, settings))
    }

    if (b.type === 'js' || b.type === 'jsx') {
      classLists.push(...findClassListsInHtmlRange(doc, 'js', b.range, settings))
    }

    if (b.type === 'css') {
      classLists.push(...findClassListsInCssRange(state, doc, b.range, b.lang))
    }
  }

  classLists.push(...findCustomClassLists(doc, settings))
  classLists = dedupeByRange(classLists)

  return classLists
}

export function findHelperFunctionsInDocument(
  state: State,
  doc: TextDocument,
): DocumentHelperFunction[] {
  if (isCssDoc(state, doc)) {
    return findHelperFunctionsInRange(doc)
  }

  let boundaries = getLanguageBoundaries(state, doc)
  if (!boundaries) return []

  return flatten(
    boundaries
      .filter((b) => b.type === 'css')
      .map(({ range }) => findHelperFunctionsInRange(doc, range)),
  )
}

function findHelperFunctionsInRange(doc: TextDocument, range?: Range): DocumentHelperFunction[] {
  let text = getTextWithoutComments(doc, 'css', range)

  // Find every instance of a helper function
  let matches = findAll(
    /(?:\b|(?<=[\s\W]))(?<![-$%#.])(?<helper>config|theme|--theme|var)\(/g,
    text,
  )

  // Eliminate matches that are attached to an `@import`
  matches = matches.filter((match) => {
    // Scan backwards to see if we're in an `@import` statement
    for (let i = match.index - 1; i >= 0; i--) {
      let char = text[i]
      if (char === '\n') break
      if (char === ';') break
      // Detecting theme(…) inside the media query list of `@import` is okay
      if (char === '(') break
      if (char === ')') break
      if (text.startsWith('@import', i)) {
        return false
      }
    }

    return true
  })

  let fns: DocumentHelperFunction[] = []

  // Collect the first argument of each fn accounting for balanced params
  const COMMA = 0x2c
  const SLASH = 0x2f
  const BACKSLASH = 0x5c
  const OPEN_PAREN = 0x28
  const CLOSE_PAREN = 0x29
  const DOUBLE_QUOTE = 0x22
  const SINGLE_QUOTE = 0x27

  let len = text.length

  for (let match of matches) {
    let argsStart = match.index + match[0].length
    let argsEnd: number | null = null
    let pathStart = argsStart
    let pathEnd: number | null = null
    let depth = 1

    // Scan until we find a `,` or balanced `)` not in quotes
    for (let idx = argsStart; idx < len; ++idx) {
      let char = text.charCodeAt(idx)

      if (char === BACKSLASH) {
        idx += 1
      }

      //
      else if (char === SINGLE_QUOTE || char === DOUBLE_QUOTE) {
        while (++idx < len) {
          let nextChar = text.charCodeAt(idx)
          if (nextChar === BACKSLASH) {
            idx += 1
            continue
          }
          if (nextChar === char) break
        }
      }

      //
      else if (char === OPEN_PAREN) {
        depth += 1
      }

      //
      else if (char === CLOSE_PAREN) {
        depth -= 1

        if (depth === 0) {
          pathEnd ??= idx
          argsEnd = idx
          break
        }
      }

      //
      else if (char === COMMA && depth === 1) {
        pathEnd ??= idx
      }
    }

    if (argsEnd === null || pathEnd === null) continue

    let helper: 'config' | 'theme' | 'var'

    if (match.groups.helper === 'theme' || match.groups.helper === '--theme') {
      helper = 'theme'
    } else if (match.groups.helper === 'var') {
      helper = 'var'
    } else if (match.groups.helper === 'config') {
      helper = 'config'
    } else {
      continue
    }

    let path = text.slice(pathStart, pathEnd)

    // Skip leading/trailing whitespace
    pathStart += path.match(/^\s+/)?.length ?? 0
    pathEnd -= path.match(/\s+$/)?.length ?? 0

    // Skip leading/trailing quotes
    let quoteStart = path.match(/^['"]+/)?.length ?? 0
    let quoteEnd = path.match(/['"]+$/)?.length ?? 0

    if (quoteStart && quoteEnd) {
      pathStart += quoteStart
      pathEnd -= quoteEnd
    }

    // Clip to the top-level slash
    depth = 1
    for (let idx = pathStart; idx < pathEnd; ++idx) {
      let char = text.charCodeAt(idx)
      if (char === BACKSLASH) {
        idx += 1
      } else if (char === OPEN_PAREN) {
        depth += 1
      } else if (char === CLOSE_PAREN) {
        depth -= 1
      } else if (char === SLASH && depth === 1) {
        pathEnd = idx
      }
    }

    // Re-slice
    path = text.slice(pathStart, pathEnd)

    // Skip leading/trailing whitespace
    //
    // This can happen if we've clipped the path down to before the `/`
    pathStart += path.match(/^\s+/)?.length ?? 0
    pathEnd -= path.match(/\s+$/)?.length ?? 0

    // Re-slice
    path = text.slice(pathStart, pathEnd)

    // Skip leading/trailing quotes
    quoteStart = path.match(/^['"]+/)?.length ?? 0
    quoteEnd = path.match(/['"]+$/)?.length ?? 0

    pathStart += quoteStart
    pathEnd -= quoteEnd

    // Re-slice
    path = text.slice(pathStart, pathEnd)

    // The `--theme(…)` function has an optional `inline` modifier that can appear at the end
    // NOTE: The non-dashed `theme(…)` function does not have this
    //
    // TODO: We should validate that this modifier is `inline` and issue a diagnostic if its not
    if (path.endsWith(' inline') && match.groups.helper === '--theme') {
      path = path.slice(0, -7)
      pathEnd -= 7
    }

    fns.push({
      helper,
      path,
      ranges: {
        full: absoluteRange(
          {
            start: indexToPosition(text, argsStart),
            end: indexToPosition(text, argsEnd),
          },
          range,
        ),
        path: absoluteRange(
          {
            start: indexToPosition(text, pathStart),
            end: indexToPosition(text, pathEnd),
          },
          range,
        ),
      },
    })
  }

  return fns
}

let lineTableCache = new LRUCache<string, ReturnType<typeof lineColumn>>(20)

function createLineTable(str: string) {
  let existing = lineTableCache.get(str)
  if (existing) return existing

  let table = lineColumn(str + '\n')
  lineTableCache.set(str, table)
  return table
}

export function indexToPosition(str: string, index: number): Position {
  let table = createLineTable(str)
  let { line, col } = table.fromIndex(index) ?? { line: 1, col: 1 }
  return { line: line - 1, character: col - 1 }
}

export async function findClassNameAtPosition(
  state: State,
  doc: TextDocument,
  position: Position,
): Promise<DocumentClassName> {
  let classLists = await findClassListsInDocument(state, doc)
  let classNames = classLists.flatMap((classList) =>
    getClassNamesInClassList(classList, state.blocklist),
  )

  let className = classNames.find((className) => isWithinRange(position, className.range))

  return className ?? null
}
