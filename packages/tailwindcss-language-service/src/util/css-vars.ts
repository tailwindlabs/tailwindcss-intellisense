export function replaceCssVarsWithFallbacks(str: string): string {
  return replaceCssVars(str, (name, fallback) => {
    // If we have a fallback then we should use that value directly
    if (fallback) return fallback

    // Don't replace the variable otherwise
    return null
  })
}

type CssVarReplacer = (name: string, fallback: string | null) => string | null

function replaceCssVars(str: string, replace: CssVarReplacer): string {
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
        let varName = str.slice(i + 4, j)
        let fallback = fallbackStart === null ? null : str.slice(fallbackStart, j)
        let replacement = replace(varName, fallback)

        if (replacement !== null) {
          str = str.slice(0, i) + replacement + str.slice(j + 1)

          // We don't want to skip past anything here because `replacement`
          // might contain more var(…) calls in which case `i` will already
          // be pointing at the right spot to start looking for them
          break
        }

        // Skip past the closing parenthesis and onto the next `var(`
        i = j + 1
        break
      }
    }
  }

  return str
}