import type { State, TailwindCssSettings } from '../state'

import { evaluateExpression } from './calc'
import { replaceCssVars, replaceCssCalc } from './replacements'
import { addPixelEquivalentsToValue } from '../pixelEquivalents'

export function addThemeValues(css: string, state: State, settings: TailwindCssSettings) {
  // TODO: Add fallbacks to variables with their theme values
  // Ideally these would just be commentss like
  // `var(--foo) /* 3rem = 48px */` or
  // `calc(var(--spacing) * 5) /* 1.25rem = 20px */`

  css = replaceCssCalc(css, (expr) => {
    let inlined = replaceCssVars(expr.value, ({ name }) => {
      if (!name.startsWith('--')) return null

      let value = state.designSystem.resolveThemeValue?.(name) ?? null
      if (value !== null) return value

      return null
    })

    let evaluated = evaluateExpression(inlined)

    // No changes were made so we can just return the original expression
    if (expr.value === evaluated) return expr.value

    let equiv = addPixelEquivalentsToValue(evaluated, settings.rootFontSize, false)
    if (equiv !== evaluated) {
      return `calc(${expr}) /* ${evaluated} = ${equiv} */`
    }

    return `calc(${expr}) /* ${evaluated} */`
  })

  css = replaceCssVars(css, ({ name }) => {
    if (!name.startsWith('--')) return null

    let value = state.designSystem.resolveThemeValue?.(name) ?? null
    if (value === null) return null

    let equiv = addPixelEquivalentsToValue(value, settings.rootFontSize, false)
    if (equiv !== value) {
      return `var(${name}) /* ${value} = ${equiv} */`
    }

    return `var(${name}) /* ${value} */`
  })

  return css
}
