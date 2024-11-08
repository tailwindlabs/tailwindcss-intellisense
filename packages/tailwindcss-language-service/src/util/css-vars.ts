import type { State } from './state'

export function replaceCssVarsWithFallbacks(state: State, str: string): string {
  return replaceCssVars(str, (name, fallback) => {
    // Replace with the value from the design system first. The design system
    // take precedences over other sources as that emulates the behavior of a
    // browser where the fallback is only used if the variable is defined.
    if (state.designSystem && name.startsWith('--')) {
      let value = state.designSystem.resolveThemeValue?.(name) ?? null
      if (value !== null) return value
    }

    if (fallback) {
      return fallback
    }

    // Don't touch it since there's no suitable replacement
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
        let varName: string
        let fallback: string | null

        if (fallbackStart === null) {
          varName = str.slice(i + 4, j)
          fallback = null
        } else {
          varName = str.slice(i + 4, fallbackStart - 1)
          fallback = str.slice(fallbackStart, j)
        }

        let replacement = replace(varName, fallback)

        if (replacement !== null) {
          str = str.slice(0, i) + replacement + str.slice(j + 1)

          // We don't want to skip past anything here because `replacement`
          // might contain more var(…) calls in which case `i` will already
          // be pointing at the right spot to start looking for them
          break
        }

        // It can't be replaced so we can avoid unncessary work by skipping over
        // the entire var(…) call.
        i = j + 1
        break
      }
    }
  }

  return str
}
