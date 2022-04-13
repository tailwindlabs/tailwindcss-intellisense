import type { TextDocument, Range, Position } from 'vscode-languageserver'
import { DocumentClassName, DocumentClassList, State, DocumentHelperFunction } from './state'
import lineColumn from 'line-column'
import { isCssContext, isCssDoc } from './css'
import { isHtmlContext } from './html'
import { isWithinRange } from './isWithinRange'
import { isJsxContext } from './js'
import { flatten } from './array'
import { getClassAttributeLexer, getComputedClassAttributeLexer } from './lexers'
import { getLanguageBoundaries } from './getLanguageBoundaries'
import { resolveRange } from './resolveRange'
import dlv from 'dlv'
import { createMultiRegexp } from './createMultiRegexp'

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

export function getClassNamesInClassList({
  classList,
  range,
  important,
}: DocumentClassList): DocumentClassName[] {
  const parts = classList.split(/(\s+)/)
  const names: DocumentClassName[] = []
  let index = 0
  for (let i = 0; i < parts.length; i++) {
    if (i % 2 === 0) {
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
  mode?: 'html' | 'css',
  includeCustom: boolean = true
): Promise<DocumentClassName[]> {
  const classLists = await findClassListsInRange(state, doc, range, mode, includeCustom)
  return flatten(
    classLists.flatMap((classList) => {
      if (Array.isArray(classList)) {
        return classList.map(getClassNamesInClassList)
      } else {
        return [getClassNamesInClassList(classList)]
      }
    })
  )
}

export async function findClassNamesInDocument(
  state: State,
  doc: TextDocument
): Promise<DocumentClassName[]> {
  const classLists = await findClassListsInDocument(state, doc)
  return flatten(
    classLists.flatMap((classList) => {
      if (Array.isArray(classList)) {
        return classList.map(getClassNamesInClassList)
      } else {
        return [getClassNamesInClassList(classList)]
      }
    })
  )
}

export function findClassListsInCssRange(doc: TextDocument, range?: Range): DocumentClassList[] {
  const text = doc.getText(range)
  const matches = findAll(
    /(@apply\s+)(?<classList>[^;}]+?)(?<important>\s*!important)?\s*[;}]/g,
    text
  )
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
  range?: Range
): Promise<DocumentClassList[]> {
  const settings = await state.editor.getConfiguration(doc.uri)
  const regexes = dlv(settings, 'tailwindCSS.experimental.classRegex', [])

  if (!Array.isArray(regexes) || regexes.length === 0) return []

  const text = doc.getText(range)
  const result: DocumentClassList[] = []

  for (let i = 0; i < regexes.length; i++) {
    try {
      let [containerRegex, classRegex] = Array.isArray(regexes[i]) ? regexes[i] : [regexes[i]]

      let containerRegex2 = createMultiRegexp(containerRegex)
      let containerMatch

      while ((containerMatch = containerRegex2.exec(text)) !== null) {
        const searchStart = doc.offsetAt(range?.start || { line: 0, character: 0 })
        const matchStart = searchStart + containerMatch.start
        const matchEnd = searchStart + containerMatch.end

        if (classRegex) {
          let classRegex2 = createMultiRegexp(classRegex)
          let classMatch

          while ((classMatch = classRegex2.exec(containerMatch.match)) !== null) {
            const classMatchStart = matchStart + classMatch.start
            const classMatchEnd = matchStart + classMatch.end
            result.push({
              classList: classMatch.match,
              range: {
                start: doc.positionAt(classMatchStart),
                end: doc.positionAt(classMatchEnd),
              },
            })
          }
        } else {
          result.push({
            classList: containerMatch.match,
            range: {
              start: doc.positionAt(matchStart),
              end: doc.positionAt(matchEnd),
            },
          })
        }
      }
    } catch (_) {}
  }

  return result
}

export function matchClassAttributes(text: string, attributes: string[]): RegExpMatchArray[] {
  const attrs = attributes.filter((x) => typeof x === 'string').flatMap((a) => [a, `\\[${a}\\]`])
  const re = /(?:\s|:|\()(ATTRS)\s*=\s*['"`{]/
  return findAll(new RegExp(re.source.replace('ATTRS', attrs.join('|')), 'gi'), text)
}

export async function findClassListsInHtmlRange(
  state: State,
  doc: TextDocument,
  range?: Range
): Promise<Array<DocumentClassList | DocumentClassList[]>> {
  const text = doc.getText(range)

  const matches = matchClassAttributes(
    text,
    (await state.editor.getConfiguration(doc.uri)).tailwindCSS.classAttributes
  )

  const result: Array<DocumentClassList | DocumentClassList[]> = []

  matches.forEach((match) => {
    const subtext = text.substr(match.index + match[0].length - 1)

    let lexer =
      match[0][0] === ':' || (match[1].startsWith('[') && match[1].endsWith(']'))
        ? getComputedClassAttributeLexer()
        : getClassAttributeLexer()
    lexer.reset(subtext)

    let classLists: Array<{ value: string; offset: number } | { value: string; offset: number }[]> =
      []
    let rootClassList: { value: string; offset: number }[] = []
    let currentClassList: { value: string; offset: number }
    let depth = 0

    try {
      for (let token of lexer) {
        if (token.type === 'classlist') {
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
            if (depth === 0) {
              rootClassList.push({
                value: currentClassList.value,
                offset: currentClassList.offset,
              })
            } else {
              classLists.push({
                value: currentClassList.value,
                offset: currentClassList.offset,
              })
            }
          }
          currentClassList = undefined
        }
        if (token.type === 'lbrace') {
          depth += 1
        } else if (token.type === 'rbrace') {
          depth -= 1
        }
      }
    } catch (_) {}

    if (currentClassList) {
      if (depth === 0) {
        rootClassList.push({
          value: currentClassList.value,
          offset: currentClassList.offset,
        })
      } else {
        classLists.push({
          value: currentClassList.value,
          offset: currentClassList.offset,
        })
      }
    }

    classLists.push(rootClassList)

    result.push(
      ...classLists
        .map((classList) => {
          if (Array.isArray(classList)) {
            return classList
              .map((classList) => resolveClassList(classList, text, match, range))
              .filter((x) => x !== null)
          } else {
            return resolveClassList(classList, text, match, range)
          }
        })
        .filter((x) => x !== null)
    )
  })

  return result
}

function resolveClassList(
  classList: { value: string; offset: number },
  text: string,
  match: RegExpMatchArray,
  range?: Range
): DocumentClassList {
  let { value, offset } = classList
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
    match.index + match[0].length - 1 + offset + value.length + afterOffset
  )

  return {
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
}

export async function findClassListsInRange(
  state: State,
  doc: TextDocument,
  range?: Range,
  mode?: 'html' | 'css',
  includeCustom: boolean = true
): Promise<Array<DocumentClassList | DocumentClassList[]>> {
  let classLists: Array<DocumentClassList | DocumentClassList[]>
  if (mode === 'css') {
    classLists = findClassListsInCssRange(doc, range)
  } else {
    classLists = await findClassListsInHtmlRange(state, doc, range)
  }
  return [...classLists, ...(includeCustom ? await findCustomClassLists(state, doc, range) : [])]
}

export async function findClassListsInDocument(
  state: State,
  doc: TextDocument
): Promise<Array<DocumentClassList | DocumentClassList[]>> {
  if (isCssDoc(state, doc)) {
    return findClassListsInCssRange(doc)
  }

  let boundaries = getLanguageBoundaries(state, doc)
  if (!boundaries) return []

  return flatten([
    ...(await Promise.all(
      boundaries
        .filter((b) => b.type === 'html' || b.type === 'jsx')
        .map(({ range }) => findClassListsInHtmlRange(state, doc, range))
    )),
    ...boundaries
      .filter((b) => b.type === 'css')
      .map(({ range }) => findClassListsInCssRange(doc, range)),
    await findCustomClassLists(state, doc),
  ])
}

export function findHelperFunctionsInDocument(
  state: State,
  doc: TextDocument
): DocumentHelperFunction[] {
  if (isCssDoc(state, doc)) {
    return findHelperFunctionsInRange(doc)
  }

  let boundaries = getLanguageBoundaries(state, doc)
  if (!boundaries) return []

  return flatten(
    boundaries
      .filter((b) => b.type === 'css')
      .map(({ range }) => findHelperFunctionsInRange(doc, range))
  )
}

export function findHelperFunctionsInRange(
  doc: TextDocument,
  range?: Range
): DocumentHelperFunction[] {
  const text = doc.getText(range)
  const matches = findAll(
    /(?<before>^|\s)(?<helper>theme|config)\((?:(?<single>')([^']+)'|(?<double>")([^"]+)")\)/gm,
    text
  )

  return matches.map((match) => {
    let value = match[4] || match[6]
    let startIndex = match.index + match.groups.before.length
    return {
      full: match[0].substr(match.groups.before.length),
      value,
      helper: match.groups.helper === 'theme' ? 'theme' : 'config',
      quotes: match.groups.single ? "'" : '"',
      range: resolveRange(
        {
          start: indexToPosition(text, startIndex),
          end: indexToPosition(text, match.index + match[0].length),
        },
        range
      ),
      valueRange: resolveRange(
        {
          start: indexToPosition(text, startIndex + match.groups.helper.length + 1),
          end: indexToPosition(
            text,
            startIndex + match.groups.helper.length + 1 + 1 + value.length + 1
          ),
        },
        range
      ),
    }
  })
}

export function indexToPosition(str: string, index: number): Position {
  const { line, col } = lineColumn(str + '\n', index)
  return { line: line - 1, character: col - 1 }
}

export async function findClassNameAtPosition(
  state: State,
  doc: TextDocument,
  position: Position
): Promise<DocumentClassName> {
  let classNames = []
  const positionOffset = doc.offsetAt(position)
  const searchRange: Range = {
    start: doc.positionAt(Math.max(0, positionOffset - 1000)),
    end: doc.positionAt(positionOffset + 1000),
  }

  if (isCssContext(state, doc, position)) {
    classNames = await findClassNamesInRange(state, doc, searchRange, 'css')
  } else if (isHtmlContext(state, doc, position) || isJsxContext(state, doc, position)) {
    classNames = await findClassNamesInRange(state, doc, searchRange, 'html')
  }

  if (classNames.length === 0) {
    return null
  }

  const className = classNames.find(({ range }) => isWithinRange(position, range))

  if (!className) return null

  return className
}
