import type { TextDocument, Range, Position } from 'vscode-languageserver'

export function isValidLocationForEmmetAbbreviation(
  document: TextDocument,
  abbreviationRange: Range
): boolean {
  const startAngle = '<'
  const endAngle = '>'
  const escape = '\\'
  const question = '?'
  let start: Position = { line: 0, character: 0 }

  let textToBackTrack = document.getText({
    start: {
      line: start.line,
      character: start.character,
    },
    end: {
      line: abbreviationRange.start.line,
      character: abbreviationRange.start.character,
    },
  })

  // Worse case scenario is when cursor is inside a big chunk of text which needs to backtracked
  // Backtrack only 500 offsets to ensure we dont waste time doing this
  if (textToBackTrack.length > 500) {
    textToBackTrack = textToBackTrack.substr(textToBackTrack.length - 500)
  }

  if (!textToBackTrack.trim()) {
    return true
  }

  let valid = true
  let foundSpace = false // If < is found before finding whitespace, then its valid abbreviation. E.g.: <div|
  let i = textToBackTrack.length - 1
  if (textToBackTrack[i] === startAngle) {
    return false
  }

  while (i >= 0) {
    const char = textToBackTrack[i]
    i--
    if (!foundSpace && /\s/.test(char)) {
      foundSpace = true
      continue
    }
    if (char === question && textToBackTrack[i] === startAngle) {
      i--
      continue
    }
    // Fix for https://github.com/Microsoft/vscode/issues/55411
    // A space is not a valid character right after < in a tag name.
    if (/\s/.test(char) && textToBackTrack[i] === startAngle) {
      i--
      continue
    }
    if (char !== startAngle && char !== endAngle) {
      continue
    }
    if (i >= 0 && textToBackTrack[i] === escape) {
      i--
      continue
    }
    if (char === endAngle) {
      if (i >= 0 && textToBackTrack[i] === '=') {
        continue // False alarm of cases like =>
      } else {
        break
      }
    }
    if (char === startAngle) {
      valid = !foundSpace
      break
    }
  }

  return valid
}
