import { TextDocument, Range, Position } from 'vscode-languageserver'
import { DocumentClassName, DocumentClassList } from './state'
import lineColumn from 'line-column'

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

export function arrFindLast<T>(arr: T[], predicate: (item: T) => boolean): T {
  for (let i = arr.length - 1; i >= 0; --i) {
    const x = arr[i]
    if (predicate(x)) {
      return x
    }
  }
  return null
}

enum Quote {
  SINGLE = "'",
  DOUBLE = '"',
  TICK = '`',
}
type StringInfo = {
  start: number
  end?: number
  char: Quote
}

export function findJsxStrings(str: string): StringInfo[] {
  const chars = str.split('')
  const strings: StringInfo[] = []
  let bracketCount = 0
  for (let i = 0; i < chars.length; i++) {
    const char = chars[i]
    if (char === '{') {
      bracketCount += 1
    } else if (char === '}') {
      bracketCount -= 1
    } else if (
      char === Quote.SINGLE ||
      char === Quote.DOUBLE ||
      char === Quote.TICK
    ) {
      let open = arrFindLast(strings, (string) => string.char === char)
      if (strings.length === 0 || !open || (open && open.end)) {
        strings.push({ start: i + 1, char })
      } else {
        open.end = i
      }
    }
    if (i !== 0 && bracketCount === 0) {
      // end
      break
    }
  }
  return strings
}

export function findClassNamesInRange(
  doc: TextDocument,
  range?: Range
): DocumentClassName[] {
  const classLists = findClassListsInRange(doc, range)
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

export function findClassListsInRange(
  doc: TextDocument,
  range?: Range
): DocumentClassList[] {
  const text = doc.getText(range)
  const matches = findAll(/(@apply\s+)(?<classList>[^;}]+)[;}]/g, text)
  const globalStart: Position = range ? range.start : { line: 0, character: 0 }

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
          line: globalStart.line + start.line,
          character: globalStart.character + start.character,
        },
        end: {
          line: globalStart.line + end.line,
          character: globalStart.character + end.character,
        },
      },
    }
  })
}

function indexToPosition(str: string, index: number): Position {
  const { line, col } = lineColumn(str + '\n', index)
  return { line: line - 1, character: col - 1 }
}
