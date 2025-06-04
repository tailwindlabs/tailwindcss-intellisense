import type { State, TailwindCssSettings } from '../state'

import { evaluateExpression } from './calc'
import { resolveVariableValue } from './lookup'
import { replaceCssVars, replaceCssCalc } from './replacements'

export function inlineThemeValues(css: string, state: State): string {
  if (!state.designSystem) return css

  let seen = new Set<string>()

  css = replaceCssCalc(css, (expr) => {
    let inlined = replaceCssVars(expr.value, {
      replace({ name, fallback }) {
        if (!name.startsWith('--')) return null

        // TODO: This isn't quite right as we might skip expanding a variable
        // that should be expanded
        if (seen.has(name)) return null

        let value = resolveVariableValue(state.designSystem, name)
        if (value === null) return fallback
        if (value.includes('var(')) seen.add(name)

        return value
      },
    })

    return evaluateExpression(inlined)
  })

  css = replaceCssVars(css, {
    replace({ name, fallback }) {
      if (!name.startsWith('--')) return null

      // TODO: This isn't quite right as we might skip expanding a variable
      // that should be expanded
      if (seen.has(name)) return null

      let value = resolveVariableValue(state.designSystem, name)
      if (value === null) return fallback
      if (value.includes('var(')) seen.add(name)

      return value
    },
  })

  return css
}
