import { Range } from 'vscode-languageserver'

export function rangesEqual(a: Range, b: Range): boolean {
  return (
    a.start.line === b.start.line &&
    a.start.character === b.start.character &&
    a.end.line === b.end.line &&
    a.end.character === b.end.character
  )
}
