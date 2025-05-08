import type { State, TailwindCssSettings } from '../state'

import { evaluateExpression } from './calc'
import { resolveVariableValue } from './lookup'
import { replaceCssVars, replaceCssCalc } from './replacements'

export function inlineThemeValues(css: string, state: State): string {
  if (!state.designSystem) return css

  css = replaceCssCalc(css, (expr) => {
    let inlined = replaceCssVars(expr.value, {
      replace({ name, fallback }) {
        if (!name.startsWith('--')) return null

        let value = resolveVariableValue(state.designSystem, name)
        if (value === null) return fallback

        return value
      },
    })

    return evaluateExpression(inlined)
  })

  css = replaceCssVars(css, {
    replace({ name, fallback }) {
      if (!name.startsWith('--')) return null

      let value = resolveVariableValue(state.designSystem, name)
      if (value === null) return fallback

      return value
    },
  })

  return css
}
