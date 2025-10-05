/**
 * A var(…) expression which may have an optional fallback value
 */
export interface CssVariable {
  kind: 'css-variable'
  range: Range
  name: string
  fallback: string | null
}

export interface Range {
  /** The zero-based offset where this node starts */
  start: number

  /** The zero-based offset where this node ends */
  end: number
}

export interface ReplacerOptions {
  /**
   * Whether or not the replacement should be performed recursively
   *
   * default: true
   */
  recursive?: boolean

  /**
   * How to replace the CSS variable
   */
  replace: CssVarReplacer
}

export type CssVarReplacer = (node: CssVariable) => string | null

/**
 * Replace all var expressions in a string using the replacer function
 */
export function replaceCssVars(
  str: string,
  { replace, recursive = true }: ReplacerOptions,
): string {
  let seen = new Set<string>()

  for (let i = 0; i < str.length; ++i) {
    if (!str.startsWith('var(', i)) continue

    let depth = 0
    let fallbackStart = null

    for (let j = i + 4; i < str.length; ++j) {
      if (str[j] === '(') {
        depth++
      } else if (str[j] === ')' && depth > 0) {
        depth--
      } else if (str[j] === '\\') {
        j++
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

        let replacement = replace({
          kind: 'css-variable',
          name: varName,
          fallback,
          range: { start: i, end: j },
        })

        if (replacement !== null) {
          // If we're replacing this variable with a reference back it *itself*
          // we should skip over it
          if (replacement.includes(`var(${varName})`) || replacement.includes(`var(${varName},`)) {
            break
          }

          str = str.slice(0, i) + replacement + str.slice(j + 1)
        }

        // Move the index back one so it can look at the spot again since it'll
        // be incremented by the outer loop. However, since we're replacing
        // variables recursively we might end up in a loop so we need to keep
        // track of which variables we've already seen and where they were
        // replaced to avoid infinite loops.
        if (recursive) {
          let key = `${i}:${replacement}`

          if (!seen.has(key)) {
            seen.add(key)
            i -= 1
          }
        }

        break
      }
    }
  }

  return str
}

/**
 * A calc(…) expression in a CSS value
 */
export interface CalcExpression {
  kind: 'calc-expression'
  range: Range
  value: string
}

export type CssCalcReplacer = (node: CalcExpression) => string | null

/**
 * Replace all calc expression in a string using the replacer function
 */
export function replaceCssCalc(str: string, replace: CssCalcReplacer): string {
  for (let i = 0; i < str.length; ++i) {
    if (!str.startsWith('calc(', i)) continue

    let depth = 0

    for (let j = i + 5; j < str.length; ++j) {
      if (str[j] === '(') {
        depth++
      } else if (str[j] === ')' && depth > 0) {
        depth--
      } else if (str[j] === ')' && depth === 0) {
        let expr = str.slice(i + 5, j)

        let replacement = replace({
          kind: 'calc-expression',
          value: expr,
          range: {
            start: i,
            end: j,
          },
        })

        if (replacement !== null) {
          str = str.slice(0, i) + replacement + str.slice(j + 1)
        }

        // We don't want to skip past anything here because `replacement`
        // might contain more var(…) calls in which case `i` will already
        // be pointing at the right spot to start looking for them
        break
      }
    }
  }

  return str
}
