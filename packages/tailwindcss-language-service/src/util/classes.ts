export type ClassRegexFilter = string | [string] | [string, string]
export interface ClassMatch {
  classList: string
  range: [start: number, end: number]
}

export function* customClassesIn({
  text,
  filters,
  cursor = null,
}: {
  text: string
  filters: ClassRegexFilter[]
  cursor?: number | null
}): Iterable<ClassMatch> {
  for (let filter of filters) {
    let [containerPattern, classPattern] = Array.isArray(filter) ? filter : [filter]

    let containerRegex = new RegExp(containerPattern, 'gd')
    let classRegex = classPattern ? new RegExp(classPattern, 'gd') : undefined

    for (let match of matchesIn(text, containerRegex, classRegex, cursor)) {
      yield match
    }
  }
}

function* matchesIn(
  text: string,
  containerRegex: RegExp,
  classRegex: RegExp | undefined,
  cursor: number | null,
): Iterable<ClassMatch> {
  for (let containerMatch of text.matchAll(containerRegex)) {
    // Don't crash when there's no capture group
    if (containerMatch[1] === undefined) {
      console.warn(`Regex /${containerRegex.source}/ must have exactly one capture group`)
      continue
    }

    const matchStart = containerMatch.indices[1][0]
    const matchEnd = matchStart + containerMatch[1].length

    // Cursor is outside of the match
    if (cursor !== null && (cursor < matchStart || cursor > matchEnd)) {
      continue
    }

    if (!classRegex) {
      yield {
        classList:
          cursor !== null ? containerMatch[1].slice(0, cursor - matchStart) : containerMatch[1],
        range: [matchStart, matchEnd],
      }
      continue
    }

    // Handle class matches inside the "container"
    for (let classMatch of containerMatch[1].matchAll(classRegex)) {
      // Don't crash when there's no capture group
      if (classMatch[1] === undefined) {
        console.warn(`Regex /${classRegex.source}/ must have exactly one capture group`)
        continue
      }

      const classMatchStart = matchStart + classMatch.indices[1][0]
      const classMatchEnd = classMatchStart + classMatch[1].length

      // Cursor is outside of the match
      if (cursor !== null && (cursor < classMatchStart || cursor > classMatchEnd)) {
        continue
      }

      yield {
        classList:
          cursor !== null ? classMatch[1].slice(0, cursor - classMatchStart) : classMatch[1],
        range: [classMatchStart, classMatchEnd],
      }
    }
  }
}
