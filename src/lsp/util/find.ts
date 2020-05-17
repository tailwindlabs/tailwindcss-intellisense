import { TextDocument, Range, Position } from 'vscode-languageserver'
import { DocumentClassName, DocumentClassList, State } from './state'
import lineColumn from 'line-column'
import { isCssContext } from './css'
import { isHtmlContext } from './html'
import { isWithinRange } from './isWithinRange'
import { isJsContext } from './js'
import { getClassAttributeLexer } from './lexers'

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

export function findClassNamesInRange(
  doc: TextDocument,
  range: Range,
  mode: 'html' | 'css'
): DocumentClassName[] {
  const classLists = findClassListsInRange(doc, range, mode)
  return [].concat.apply(
    [],
    classLists.map(({ classList, range }) => {
      const parts = classList.split(/(\s+)/)
      const names: DocumentClassName[] = []
      let index = 0
      for (let i = 0; i < parts.length; i++) {
        if (i % 2 === 0) {
          const start = indexToPosition(classList, index)
          const end = indexToPosition(classList, index + parts[i].length)
          names.push({
            className: parts[i],
            range: {
              start: {
                line: range.start.line + start.line,
                character:
                  (end.line === 0 ? range.start.character : 0) +
                  start.character,
              },
              end: {
                line: range.start.line + end.line,
                character:
                  (end.line === 0 ? range.start.character : 0) + end.character,
              },
            },
          })
        }
        index += parts[i].length
      }
      return names
    })
  )
}

export function findClassListsInCssRange(
  doc: TextDocument,
  range: Range
): DocumentClassList[] {
  const text = doc.getText(range)
  const matches = findAll(/(@apply\s+)(?<classList>[^;}]+)[;}]/g, text)

  return matches.map((match) => {
    const start = indexToPosition(text, match.index + match[1].length)
    const end = indexToPosition(
      text,
      match.index + match[1].length + match.groups.classList.length
    )
    return {
      classList: match.groups.classList,
      range: {
        start: {
          line: range.start.line + start.line,
          character: range.start.character + start.character,
        },
        end: {
          line: range.start.line + end.line,
          character: range.start.character + end.character,
        },
      },
    }
  })
}

export function findClassListsInHtmlRange(
  doc: TextDocument,
  range: Range
): DocumentClassList[] {
  const text = doc.getText(range)
  const matches = findAll(/[\s:]class(?:Name)?=['"`{]/g, text)
  const result: DocumentClassList[] = []

  matches.forEach((match) => {
    const subtext = text.substr(match.index + match[0].length - 1, 200)

    let lexer = getClassAttributeLexer()
    lexer.reset(subtext)

    let classLists: { value: string; offset: number }[] = []
    let token: moo.Token
    let currentClassList: { value: string; offset: number }

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
            match.index +
              match[0].length -
              1 +
              offset +
              value.length +
              afterOffset
          )

          return {
            classList: value,
            range: {
              start: {
                line: range.start.line + start.line,
                character: range.start.character + start.character,
              },
              end: {
                line: range.start.line + end.line,
                character: range.start.character + end.character,
              },
            },
          }
        })
        .filter((x) => x !== null)
    )
  })

  return result
}

export function findClassListsInRange(
  doc: TextDocument,
  range: Range,
  mode: 'html' | 'css'
): DocumentClassList[] {
  if (mode === 'css') {
    return findClassListsInCssRange(doc, range)
  }
  return findClassListsInHtmlRange(doc, range)
}

function indexToPosition(str: string, index: number): Position {
  const { line, col } = lineColumn(str + '\n', index)
  return { line: line - 1, character: col - 1 }
}

export function findClassNameAtPosition(
  state: State,
  doc: TextDocument,
  position: Position
): DocumentClassName {
  let classNames = []
  const searchRange = {
    start: { line: Math.max(position.line - 10, 0), character: 0 },
    end: { line: position.line + 10, character: 0 },
  }

  if (isCssContext(state, doc, position)) {
    classNames = findClassNamesInRange(doc, searchRange, 'css')
  } else if (
    isHtmlContext(state, doc, position) ||
    isJsContext(state, doc, position)
  ) {
    classNames = findClassNamesInRange(doc, searchRange, 'html')
  }

  if (classNames.length === 0) {
    return null
  }

  const className = classNames.find(({ range }) =>
    isWithinRange(position, range)
  )

  if (!className) return null

  return className
}
