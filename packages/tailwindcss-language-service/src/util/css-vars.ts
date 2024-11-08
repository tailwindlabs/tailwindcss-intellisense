export function replaceCssVarsWithFallbacks(str: string): string {
  for (let i = 0; i < str.length; ++i) {
    if (!str.startsWith('var(', i)) continue

    let depth = 0
    let fallbackStart = null

    for (let j = i + 4; i < str.length; ++j) {
      if (str[j] === '(') {
        depth++
      } else if (str[j] === ')' && depth > 0) {
        depth--
      } else if (str[j] === ',' && depth === 0 && fallbackStart === null) {
        fallbackStart = j + 1
      } else if (str[j] === ')' && depth === 0) {
        if (fallbackStart === null) {
          i = j + 1
          break
        }

        let fallbackEnd = j
        str = str.slice(0, i) + str.slice(fallbackStart, fallbackEnd) + str.slice(j + 1)
        break
      }
    }
  }

  return str
}
