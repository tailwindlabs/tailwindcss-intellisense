import type { Position, Range } from 'vscode-languageserver'

export function isWithinRange(position: Position, range: Range): boolean {
  if (
    position.line === range.start.line &&
    position.character >= range.start.character
  ) {
    if (
      position.line === range.end.line &&
      position.character > range.end.character
    ) {
      return false
    } else {
      return true
    }
  }
  if (
    position.line === range.end.line &&
    position.character <= range.end.character
  ) {
    if (
      position.line === range.start.line &&
      position.character < range.end.character
    ) {
      return false
    } else {
      return true
    }
  }
  if (position.line > range.start.line && position.line < range.end.line) {
    return true
  }
  return false
}
