import type { Range, Position } from 'vscode-languageserver'
import type { TextDocument } from 'vscode-languageserver-textdocument'
import type { DocumentClassName, DocumentClassList, State, DocumentHelperFunction } from './state'
import lineColumn from 'line-column'
import { isCssContext, isCssDoc } from './css'
import { isHtmlContext, isVueDoc } from './html'
import { isWithinRange } from './isWithinRange'
import { isJsContext } from './js'
import { dedupeByRange, flatten } from './array'
import { getClassAttributeLexer, getComputedClassAttributeLexer } from './lexers'
import { getLanguageBoundaries } from './getLanguageBoundaries'
import { absoluteRange } from './absoluteRange'
import { getTextWithoutComments } from './doc'
import { isSemicolonlessCssLanguage } from './languages'
import { customClassesIn } from './classes'
import { SEARCH_RANGE } from './constants'

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

export function getClassNamesInClassList(
  { classList, range, important }: DocumentClassList,
  blocklist: State['blocklist'],
): DocumentClassName[] {
  const parts = classList.split(/(\s+)/)
  const names: DocumentClassName[] = []
  let index = 0
  for (let i = 0; i < parts.length; i++) {
    if (i % 2 === 0 && !blocklist.includes(parts[i])) {
      const start = indexToPosition(classList, index)
      const end = indexToPosition(classList, index + parts[i].length)
      names.push({
        className: parts[i],
        classList: {
          classList,
          range,
          important,
        },
        relativeRange: {
          start,
          end,
        },
        range: {
          start: {
            line: range.start.line + start.line,
            character: (end.line === 0 ? range.start.character : 0) + start.character,
          },
          end: {
            line: range.start.line + end.line,
            character: (end.line === 0 ? range.start.character : 0) + end.character,
          },
        },
      })
    }
    index += parts[i].length
  }
  return names
}

export async function findClassNamesInRange(
  state: State,
  doc: TextDocument,
  range?: Range,
  mode?: 'html' | 'css' | 'jsx',
  includeCustom: boolean = true,
): Promise<DocumentClassName[]> {
  const classLists = await findClassListsInRange(state, doc, range, mode, includeCustom)
  return flatten(
    classLists.map((classList) => getClassNamesInClassList(classList, state.blocklist)),
  )
}

export async function findClassNamesInDocument(
  state: State,
  doc: TextDocument,
): Promise<DocumentClassName[]> {
  const classLists = await findClassListsInDocument(state, doc)
  return flatten(
    classLists.map((classList) => getClassNamesInClassList(classList, state.blocklist)),
  )
}

export function findClassListsInCssRange(
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
    return {
      classList: match.groups.classList,
      important: Boolean(match.groups.important),
      range: {
        start: {
          line: globalStart.line + start.line,
          character: (end.line === 0 ? globalStart.character : 0) + start.character,
        },
        end: {
          line: globalStart.line + end.line,
          character: (end.line === 0 ? globalStart.character : 0) + end.character,
        },
      },
    }
  })
}

async function findCustomClassLists(
  state: State,
  doc: TextDocument,
  range?: Range,
): Promise<DocumentClassList[]> {
  const settings = await state.editor.getConfiguration(doc.uri)
  const regexes = settings.tailwindCSS.experimental.classRegex
  if (!Array.isArray(regexes) || regexes.length === 0) return []

  const text = doc.getText(range ? { ...range, start: doc.positionAt(0) } : undefined)
  const result: DocumentClassList[] = []

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
  let FN_NAMES = /(?<=^|[:=,;\s{()])([\p{ID_Start}$_][\p{ID_Continue}$_.]*)[(`]/dgiu
  let foundFns = findAll(FN_NAMES, text)

  // 3. Match against the function names in the document
  let re = /^(NAMES)$/
  let isClassFn = new RegExp(re.source.replace('NAMES', names.join('|')), 'i')

  let matches = foundFns.filter((fn) => isClassFn.test(fn[1]))

  return matches
}

export async function findClassListsInHtmlRange(
  state: State,
  doc: TextDocument,
  type: 'html' | 'js' | 'jsx',
  range?: Range,
): Promise<DocumentClassList[]> {
  if (!state.editor) return []

  const text = getTextWithoutComments(doc, type, range)

  const settings = (await state.editor.getConfiguration(doc.uri)).tailwindCSS
  const matches = matchClassAttributes(text, settings.classAttributes)

  let boundaries = getLanguageBoundaries(state, doc)

  for (let boundary of boundaries ?? []) {
    let isJsContext = boundary.type === 'js' || boundary.type === 'jsx'
    if (!isJsContext) continue
    if (!settings.classFunctions?.length) continue

    let str = doc.getText(boundary.range)
    let offset = doc.offsetAt(boundary.range.start)
    let fnMatches = matchClassFunctions(str, settings.classFunctions)

    fnMatches.forEach((match) => {
      if (match.index) match.index += offset
    })

    matches.push(...fnMatches)
  }

  const existingResultSet = new Set<string>()
  const results: DocumentClassList[] = []

  matches.forEach((match) => {
    const subtext = text.substr(match.index + match[0].length - 1)

    let lexer =
      match[0][0] === ':' || (match[1].startsWith('[') && match[1].endsWith(']'))
        ? getComputedClassAttributeLexer()
        : getClassAttributeLexer()
    lexer.reset(subtext)

    let classLists: { value: string; offset: number }[] = []
    let token: moo.Token
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

      const result: DocumentClassList = {
        classList: value.substr(beforeOffset, value.length + afterOffset),
        range: {
          start: {
            line: (range?.start.line || 0) + start.line,
            character: (end.line === 0 ? range?.start.character || 0 : 0) + start.character,
          },
          end: {
            line: (range?.start.line || 0) + end.line,
            character: (end.line === 0 ? range?.start.character || 0 : 0) + end.character,
          },
        },
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

export async function findClassListsInRange(
  state: State,
  doc: TextDocument,
  range?: Range,
  mode?: 'html' | 'css' | 'jsx',
  includeCustom: boolean = true,
  lang?: string,
): Promise<DocumentClassList[]> {
  let classLists: DocumentClassList[] = []
  if (mode === 'css') {
    classLists = findClassListsInCssRange(state, doc, range, lang)
  } else if (mode === 'html' || mode === 'jsx') {
    classLists = await findClassListsInHtmlRange(state, doc, mode, range)
  }
  return dedupeByRange([
    ...classLists,
    ...(includeCustom ? await findCustomClassLists(state, doc, range) : []),
  ])
}

export async function findClassListsInDocument(
  state: State,
  doc: TextDocument,
): Promise<DocumentClassList[]> {
  if (isCssDoc(state, doc)) {
    return findClassListsInCssRange(state, doc)
  }

  let boundaries = getLanguageBoundaries(state, doc)
  if (!boundaries) return []

  return dedupeByRange(
    flatten([
      ...(await Promise.all(
        boundaries
          .filter((b) => b.type === 'html' || b.type === 'jsx')
          .map(({ type, range }) =>
            findClassListsInHtmlRange(state, doc, type === 'html' ? 'html' : 'jsx', range),
          ),
      )),
      ...boundaries
        .filter((b) => b.type === 'css')
        .map(({ range, lang }) => findClassListsInCssRange(state, doc, range, lang)),
      await findCustomClassLists(state, doc),
    ]),
  )
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

function getFirstCommaIndex(str: string): number | null {
  let quoteChar: string | undefined
  for (let i = 0; i < str.length; i++) {
    let char = str[i]
    if (char === ',' && !quoteChar) {
      return i
    }
    if (!quoteChar && (char === '"' || char === "'")) {
      quoteChar = char
    } else if (char === quoteChar) {
      quoteChar = undefined
    }
  }
  return null
}

export function findHelperFunctionsInRange(
  doc: TextDocument,
  range?: Range,
): DocumentHelperFunction[] {
  let text = getTextWithoutComments(doc, 'css', range)

  // Find every instance of a helper function
  let matches = findAll(/\b(?<helper>config|theme|--theme|var)\(/g, text)

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
    let argsEnd = null
    let pathStart = argsStart
    let pathEnd = null
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

    if (argsEnd === null) continue

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

export function indexToPosition(str: string, index: number): Position {
  const { line, col } = lineColumn(str + '\n').fromIndex(index) ?? { line: 1, col: 1 }
  return { line: line - 1, character: col - 1 }
}

export async function findClassNameAtPosition(
  state: State,
  doc: TextDocument,
  position: Position,
): Promise<DocumentClassName> {
  let classNames: DocumentClassName[] = []
  const positionOffset = doc.offsetAt(position)
  const searchRange: Range = {
    start: doc.positionAt(0),
    end: doc.positionAt(positionOffset + SEARCH_RANGE),
  }

  if (isVueDoc(doc)) {
    let boundaries = getLanguageBoundaries(state, doc)

    let groups = await Promise.all(
      boundaries.map(async ({ type, range, lang }) => {
        if (type === 'css') {
          return await findClassListsInRange(state, doc, range, 'css', true, lang)
        }

        if (type === 'html') {
          return await findClassListsInRange(state, doc, range, 'html')
        }

        if (type === 'js' || type === 'jsx') {
          return await findClassListsInRange(state, doc, range, 'jsx')
        }

        return []
      }),
    )

    classNames = dedupeByRange(flatten(groups)).flatMap((classList) =>
      getClassNamesInClassList(classList, state.blocklist),
    )
  } else if (isCssContext(state, doc, position)) {
    classNames = await findClassNamesInRange(state, doc, searchRange, 'css')
  } else if (isHtmlContext(state, doc, position)) {
    classNames = await findClassNamesInRange(state, doc, searchRange, 'html')
  } else if (isJsContext(state, doc, position)) {
    classNames = await findClassNamesInRange(state, doc, searchRange, 'jsx')
  } else {
    classNames = await findClassNamesInRange(state, doc, searchRange)
  }

  if (classNames.length === 0) {
    return null
  }

  const className = classNames.find(({ range }) => isWithinRange(position, range))

  if (!className) return null

  return className
}
