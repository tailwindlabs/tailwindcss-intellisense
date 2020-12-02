import type { Range } from 'vscode-languageserver'

export function resolveRange(range: Range, relativeTo?: Range) {
  return {
    start: {
      line: (relativeTo?.start.line || 0) + range.start.line,
      character:
        (range.end.line === 0 ? relativeTo?.start.character || 0 : 0) +
        range.start.character,
    },
    end: {
      line: (relativeTo?.start.line || 0) + range.end.line,
      character:
        (range.end.line === 0 ? relativeTo?.start.character || 0 : 0) +
        range.end.character,
    },
  }
}
