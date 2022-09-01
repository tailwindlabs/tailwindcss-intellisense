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
import { rangesEqual } from './rangesEqual'
import Regex from 'becke-ch--regex--s0-0-v1--base--pl--lib'
import { getTextWithoutComments } from './doc'

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
  mode?: 'html' | 'css' | 'jsx',
  includeCustom: boolean = true
): Promise<DocumentClassName[]> {
  const classLists = await findClassListsInRange(state, doc, range, mode, includeCustom)
  return flatten(classLists.map(getClassNamesInClassList))
}

export async function findClassNamesInDocument(
  state: State,
  doc: TextDocument
): Promise<DocumentClassName[]> {
  const classLists = await findClassListsInDocument(state, doc)
  return flatten(classLists.map(getClassNamesInClassList))
}

export function findClassListsInCssRange(doc: TextDocument, range?: Range): DocumentClassList[] {
  const text = getTextWithoutComments(doc, 'css', range)
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
      let [containerRegexString, classRegexString] = Array.isArray(regexes[i])
        ? regexes[i]
        : [regexes[i]]

      let containerRegex = new Regex(containerRegexString, 'g')
      let containerMatch: ReturnType<Regex['exec']>

      while ((containerMatch = containerRegex.exec(text)) !== null) {
        const searchStart = doc.offsetAt(range?.start || { line: 0, character: 0 })
        const matchStart = searchStart + containerMatch.index[1]
        const matchEnd = matchStart + containerMatch[1].length

        if (classRegexString) {
          let classRegex = new Regex(classRegexString, 'g')
          let classMatch: ReturnType<Regex['exec']>

          while ((classMatch = classRegex.exec(containerMatch[1])) !== null) {
            const classMatchStart = matchStart + classMatch.index[1]
            const classMatchEnd = classMatchStart + classMatch[1].length
            result.push({
              classList: classMatch[1],
              range: {
                start: doc.positionAt(classMatchStart),
                end: doc.positionAt(classMatchEnd),
              },
            })
          }
        } else {
          result.push({
            classList: containerMatch[1],
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
  type: 'html' | 'js' | 'jsx',
  range?: Range
): Promise<DocumentClassList[]> {
  const text = getTextWithoutComments(doc, type, range)

  const matches = matchClassAttributes(
    text,
    (await state.editor.getConfiguration(doc.uri)).tailwindCSS.classAttributes
  )

  const result: DocumentClassList[] = []

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

    result.push(
      ...classLists
        .map(({ value, offset }) => {
          if (value.trim() === '') {
            return null
          }

          const before = value.match(/^\s*/)
          const beforeOffset = before === null ? 0 : before[0].length
          const after = value.match(/\s*$/)
          const afterOffset = after === null ? 0 : -after[0].length

          const start = indexToPosition(
            text,
            match.index + match[0].length - 1 + offset + beforeOffset
          )
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
        })
        .filter((x) => x !== null)
    )
  })

  return result
}

function dedupeClassLists(classLists: DocumentClassList[]): DocumentClassList[] {
  return classLists.filter(
    (classList, classListIndex) =>
      classListIndex === classLists.findIndex((c) => rangesEqual(c.range, classList.range))
  )
}

export async function findClassListsInRange(
  state: State,
  doc: TextDocument,
  range?: Range,
  mode?: 'html' | 'css' | 'jsx',
  includeCustom: boolean = true
): Promise<DocumentClassList[]> {
  let classLists: DocumentClassList[]
  if (mode === 'css') {
    classLists = findClassListsInCssRange(doc, range)
  } else {
    classLists = await findClassListsInHtmlRange(state, doc, mode, range)
  }
  return dedupeClassLists([
    ...classLists,
    ...(includeCustom ? await findCustomClassLists(state, doc, range) : []),
  ])
}

export async function findClassListsInDocument(
  state: State,
  doc: TextDocument
): Promise<DocumentClassList[]> {
  if (isCssDoc(state, doc)) {
    return findClassListsInCssRange(doc)
  }

  let boundaries = getLanguageBoundaries(state, doc)
  if (!boundaries) return []

  return dedupeClassLists(
    flatten([
      ...(await Promise.all(
        boundaries
          .filter((b) => b.type === 'html' || b.type === 'jsx')
          .map(({ type, range }) =>
            findClassListsInHtmlRange(state, doc, type === 'html' ? 'html' : 'jsx', range)
          )
      )),
      ...boundaries
        .filter((b) => b.type === 'css')
        .map(({ range }) => findClassListsInCssRange(doc, range)),
      await findCustomClassLists(state, doc),
    ])
  )
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
  const text = getTextWithoutComments(doc, 'css', range)
  const matches = findAll(
    /(?<before>^|\s)(?<helper>theme|config)\((?:(?<single>')([^']+)'|(?<double>")([^"]+)")[^)]*\)/gm,
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
  } else if (isHtmlContext(state, doc, position)) {
    classNames = await findClassNamesInRange(state, doc, searchRange, 'html')
  } else if (isJsxContext(state, doc, position)) {
    classNames = await findClassNamesInRange(state, doc, searchRange, 'jsx')
  }

  if (classNames.length === 0) {
    return null
  }

  const className = classNames.find(({ range }) => isWithinRange(position, range))

  if (!className) return null

  return className
}
