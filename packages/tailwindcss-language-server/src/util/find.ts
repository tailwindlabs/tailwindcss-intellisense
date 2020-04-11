export function findAll(re: RegExp, str: string): RegExpMatchArray[] {
  let match: RegExpMatchArray
  let matches: RegExpMatchArray[] = []
  while ((match = re.exec(str)) !== null) {
    matches.push({ ...match })
  }
  return matches
}

export function findLast(re: RegExp, str: string): RegExpMatchArray {
  const matches = findAll(re, str)
  if (matches.length === 0) {
    return null
  }
  return matches[matches.length - 1]
}

export function arrFindLast<T>(arr: T[], predicate: (item: T) => boolean): T {
  for (let i = arr.length - 1; i >= 0; --i) {
    const x = arr[i]
    if (predicate(x)) {
      return x
    }
  }
  return null
}

enum Quote {
  SINGLE = "'",
  DOUBLE = '"',
  TICK = '`',
}
type StringInfo = {
  start: number
  end?: number
  char: Quote
}

export function findJsxStrings(str: string): StringInfo[] {
  const chars = str.split('')
  const strings: StringInfo[] = []
  let bracketCount = 0
  for (let i = 0; i < chars.length; i++) {
    const char = chars[i]
    if (char === '{') {
      bracketCount += 1
    } else if (char === '}') {
      bracketCount -= 1
    } else if (
      char === Quote.SINGLE ||
      char === Quote.DOUBLE ||
      char === Quote.TICK
    ) {
      let open = arrFindLast(strings, (string) => string.char === char)
      if (strings.length === 0 || !open || (open && open.end)) {
        strings.push({ start: i + 1, char })
      } else {
        open.end = i
      }
    }
    if (i !== 0 && bracketCount === 0) {
      // end
      break
    }
  }
  return strings
}
