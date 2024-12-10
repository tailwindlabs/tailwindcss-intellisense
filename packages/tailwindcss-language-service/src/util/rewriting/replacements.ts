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

export type CssVarReplacer = (node: CssVariable) => string | null

/**
 * Replace all var expressions in a string using the replacer function
 */
export function replaceCssVars(str: string, replace: CssVarReplacer): string {
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

        let replacement = replace({
          kind: 'css-variable',
          name: varName,
          fallback,
          range: { start: i, end: j },
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

    for (let j = i + 5; i < str.length; ++j) {
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
