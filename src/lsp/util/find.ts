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

export function findClassNamesInRange(
  doc: TextDocument,
  range: Range
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

function indexToPosition(str: string, index: number): Position {
  const { line, col } = lineColumn(str + '\n', index)
  return { line: line - 1, character: col - 1 }
}
