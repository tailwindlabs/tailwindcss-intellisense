import type { Range } from 'vscode-languageserver'

export function absoluteRange(range: Range, reference?: Range) {
  return {
    start: {
      line: (reference?.start.line || 0) + range.start.line,
      character:
        (range.end.line === 0 ? reference?.start.character || 0 : 0) +
        range.start.character,
    },
    end: {
      line: (reference?.start.line || 0) + range.end.line,
      character:
        (range.end.line === 0 ? reference?.start.character || 0 : 0) +
        range.end.character,
    },
  }
}
