import type { State, TailwindCssSettings } from '../state'

import { evaluateExpression } from './calc'
import { replaceCssVars, replaceCssCalc } from './replacements'

export function inlineThemeValues(css: string, state: State) {
  if (!state.designSystem) return css

  css = replaceCssCalc(css, (expr) => {
    let inlined = replaceCssVars(expr.value, ({ name, fallback }) => {
      if (!name.startsWith('--')) return null

      let value = state.designSystem.resolveThemeValue?.(name) ?? null
      if (value === null) return fallback

      // Inline CSS calc expressions in theme values
      value = replaceCssCalc(value, (expr) => evaluateExpression(expr.value))

      return value
    })

    return evaluateExpression(inlined)
  })

  css = replaceCssVars(css, ({ name, fallback }) => {
    if (!name.startsWith('--')) return null

    let value = state.designSystem.resolveThemeValue?.(name) ?? null
    if (value === null) return fallback

    value = replaceCssCalc(value, (expr) => {
      let evaluated = evaluateExpression(expr.value)
      if (!evaluated) return null
      if (evaluated === expr.value) return null

      return `≈ ${evaluated}`
    })

    return value
  })

  return css
}
