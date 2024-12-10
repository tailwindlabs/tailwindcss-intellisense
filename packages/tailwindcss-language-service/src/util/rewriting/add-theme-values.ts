import type { State } from '../state'

import { replaceCssVars } from './replacements'

export function addThemeValues(css: string, state: State) {
  if (!state.designSystem) return css

  // Add fallbacks to variables with their theme values
  // Ideally these would just be commentss like
  // `var(--foo) /* 3rem = 48px */` or
  // `calc(var(--spacing) * 5) /* 1.25rem = 20px */`
  css = replaceCssVars(css, ({ name }) => {
    if (!name.startsWith('--')) return null

    let value = state.designSystem.resolveThemeValue?.(name) ?? null
    if (value === null) return null

    return `var(${name}, ${value})`
  })
}
