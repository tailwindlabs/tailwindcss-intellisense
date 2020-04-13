import { TextDocument, Range, Position } from 'vscode-languageserver'
import { State } from './state'
const dlv = require('dlv')

export function getClassNameAtPosition(
  document: TextDocument,
  position: Position
): { className: string; range: Range } {
  const range1: Range = {
    start: { line: Math.max(position.line - 5, 0), character: 0 },
    end: position,
  }
  const text1: string = document.getText(range1)

  if (!/\bclass(Name)?=['"][^'"]*$/.test(text1)) return null

  const range2: Range = {
    start: { line: Math.max(position.line - 5, 0), character: 0 },
    end: { line: position.line + 1, character: position.character },
  }
  const text2: string = document.getText(range2)

  let str: string = text1 + text2.substr(text1.length).match(/^([^"' ]*)/)[0]
  let matches: RegExpMatchArray = str.match(/\bclass(Name)?=["']([^"']+)$/)

  if (!matches) return null

  let className: string = matches[2].split(' ').pop()
  if (!className) return null

  let range: Range = {
    start: {
      line: position.line,
      character:
        position.character + str.length - text1.length - className.length,
    },
    end: {
      line: position.line,
      character: position.character + str.length - text1.length,
    },
  }

  return { className, range }
}

export function getClassNameParts(state: State, className: string): string[] {
  let separator = state.separator
  className = className.replace(/^\./, '')
  let parts: string[] = className.split(separator)

  if (parts.length === 1) {
    return dlv(state.classNames.classNames, [className, '__rule']) === true ||
      Array.isArray(dlv(state.classNames.classNames, [className]))
      ? [className]
      : null
  }

  let points = combinations('123456789'.substr(0, parts.length - 1)).map((x) =>
    x.split('').map((x) => parseInt(x, 10))
  )

  let possibilities: string[][] = [
    [className],
    ...points.map((p) => {
      let result = []
      let i = 0
      p.forEach((x) => {
        result.push(parts.slice(i, x).join('-'))
        i = x
      })
      result.push(parts.slice(i).join('-'))
      return result
    }),
  ]

  return possibilities.find((key) => {
    if (
      dlv(state.classNames.classNames, [...key, '__rule']) === true ||
      Array.isArray(dlv(state.classNames.classNames, [...key]))
    ) {
      return true
    }
    return false
  })
}

function combinations(str: string): string[] {
  let fn = function (active: string, rest: string, a: string[]) {
    if (!active && !rest) return
    if (!rest) {
      a.push(active)
    } else {
      fn(active + rest[0], rest.slice(1), a)
      fn(active, rest.slice(1), a)
    }
    return a
  }
  return fn('', str, [])
}
