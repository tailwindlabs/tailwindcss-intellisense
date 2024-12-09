import { replaceCssVars } from './css-vars'
import { State } from './state'

interface Location {
  start: number
  end: number
}
type CssCalcReplacer = (name: string, location: Location) => string | null

export function inlineCalc(state: State, str: string): string {
  if (!state.designSystem) return str

  return replaceCssCalc(str, (expr) => {
    expr = replaceCssVars(expr, (name) => {
      if (!name.startsWith('--')) return null

      let value = state.designSystem.resolveThemeValue?.(name) ?? null
      if (value !== null) return value

      return null
    })

    return evaluateExpression(expr)
  })
}

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
        let varName = str.slice(i + 5, j)

        let replacement = replace(varName, {
          start: i,
          end: j,
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

function parseLength(length: string): [number, string] | null {
  let regex = /^(-?\d*\.?\d+)([a-z%]*)$/i
  let match = length.match(regex)

  if (!match) return null

  let numberPart = parseFloat(match[1])
  if (isNaN(numberPart)) return null

  return [numberPart, match[2]]
}

function round(n: number, precision: number): number {
  return Math.round(n * Math.pow(10, precision)) / Math.pow(10, precision)
}

export function evaluateExpression(str: string): string | null {
  // We're only interested simple calc expressions of the form
  // A + B, A - B, A * B, A / B

  let parts = str.split(/\s+([+*/-])\s+/)

  if (parts.length === 1) return null
  if (parts.length !== 3) return null

  let a = parseLength(parts[0])
  let b = parseLength(parts[2])

  // Not parsable
  if (!a || !b) {
    return null
  }

  // Addition and subtraction require the same units
  if ((parts[1] === '+' || parts[1] === '-') && a[1] !== b[1]) {
    return null
  }

  // Multiplication and division require at least one unit to be empty
  if ((parts[1] === '*' || parts[1] === '/') && a[1] !== '' && b[1] !== '') {
    return null
  }

  switch (parts[1]) {
    case '+':
      return round(a[0] + b[0], 4).toString() + a[1]
    case '*':
      return round(a[0] * b[0], 4).toString() + a[1]
    case '-':
      return round(a[0] - b[0], 4).toString() + a[1]
    case '/':
      return round(a[0] / b[0], 4).toString() + a[1]
  }

  return null
}
