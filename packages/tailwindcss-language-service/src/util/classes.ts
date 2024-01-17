
export type ClassRegexEntry = string | [string] | [string, string]
export type ClassRegex = [container: RegExp, cls?: RegExp]
export interface ClassMatch {
  classList: string
}

export function customClassesIn(
  str: string,
  cursor: number,
  patterns: ClassRegexEntry[],
): ClassMatch | null {
  for (let pattern of patterns) {
    let normalized = Array.isArray(pattern)
      ? pattern
      : [pattern]

    let regexes = normalized.map((pattern) => new RegExp(pattern, 'gd'))

    let match = firstMatchIn(str, cursor, regexes as ClassRegex)

    if (match) {
      return match
    }
  }

  return null
}

function firstMatchIn(
  str: string,
  cursor: number,
  [containerRegex, classRegex]: ClassRegex,
): ClassMatch | null {
  let containerMatch: ReturnType<RegExp['exec']>

  while ((containerMatch = containerRegex.exec(str)) !== null) {
    const matchStart = containerMatch.indices[1][0]
    const matchEnd = matchStart + containerMatch[1].length

    // Cursor is outside of the match
    if (cursor < matchStart || cursor > matchEnd) {
      continue
    }

    if (! classRegex) {
      return {
        classList: containerMatch[1].slice(0, cursor - matchStart)
      }
    }

    // Handle class matches inside the "container"
    let classMatch: ReturnType<RegExp['exec']>

    while ((classMatch = classRegex.exec(containerMatch[1])) !== null) {
      const classMatchStart = matchStart + classMatch.indices[1][0]
      const classMatchEnd = classMatchStart + classMatch[1].length

      // Cursor is outside of the match
      if (cursor < classMatchStart || cursor > classMatchEnd) {
        continue
      }

      return {
        classList: classMatch[1].slice(0, cursor - classMatchStart),
      }
    }

    return null
  }

  return null
}
