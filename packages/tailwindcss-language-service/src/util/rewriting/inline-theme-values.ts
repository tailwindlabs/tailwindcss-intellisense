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

      return value
    })

    return evaluateExpression(inlined)
  })

  css = replaceCssVars(css, ({ name, fallback }) => {
    if (!name.startsWith('--')) return null

    let value = state.designSystem.resolveThemeValue?.(name) ?? null
    if (value === null) return fallback

    return value
  })

  return css
}
