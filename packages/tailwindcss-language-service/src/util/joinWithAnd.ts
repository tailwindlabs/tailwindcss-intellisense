export function joinWithAnd(strings: string[]): string {
  return strings.reduce((acc, cur, i) => {
    if (i === 0) {
      return cur
    }
    if (strings.length > 1 && i === strings.length - 1) {
      return `${acc} and ${cur}`
    }
    return `${acc}, ${cur}`
  }, '')
}
