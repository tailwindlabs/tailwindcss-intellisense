import { Range } from 'vscode-languageserver'
import lineColumn from 'line-column'
import { ensureArray } from './array'

export function removeRangesFromString(
  str: string,
  rangeOrRanges: Range | Range[]
): string {
  let ranges = ensureArray(rangeOrRanges)
  let finder = lineColumn(str + '\n', { origin: 0 })
  let indexRanges: { start: number; end: number }[] = []

  ranges.forEach((range) => {
    let start = finder.toIndex(range.start.line, range.start.character)
    let end = finder.toIndex(range.end.line, range.end.character)
    for (let i = start - 1; i >= 0; i--) {
      if (/\s/.test(str.charAt(i))) {
        start = i
      } else {
        break
      }
    }
    indexRanges.push({ start, end })
  })

  indexRanges.sort((a, b) => a.start - b.start)

  let result = ''
  let i = 0

  indexRanges.forEach((indexRange) => {
    result += str.substring(i, indexRange.start)
    i = indexRange.end
  })

  result += str.substring(i)

  return result.trim()
}
