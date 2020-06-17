import { Range } from 'vscode-languageserver'
import lineColumn from 'line-column'

export function removeRangeFromString(str: string, range: Range): string {
  let finder = lineColumn(str + '\n', { origin: 0 })
  let start = finder.toIndex(range.start.line, range.start.character)
  let end = finder.toIndex(range.end.line, range.end.character)
  for (let i = start - 1; i >= 0; i--) {
    if (/\s/.test(str.charAt(i))) {
      start = i
    } else {
      break
    }
  }
  return (str.substr(0, start) + str.substr(end)).trim()
}
