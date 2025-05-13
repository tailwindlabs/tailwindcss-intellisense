import type { State } from '../state'
import { resolveVariableValue } from './lookup'
import { replaceCssVars } from './replacements'

export function replaceCssVarsWithFallbacks(state: State, str: string): string {
  let seen = new Set<string>()

  return replaceCssVars(str, {
    replace({ name, fallback }) {
      // Replace with the value from the design system first. The design system
      // take precedences over other sources as that emulates the behavior of a
      // browser where the fallback is only used if the variable is defined.
      if (state.designSystem && name.startsWith('--')) {
        // TODO: This isn't quite right as we might skip expanding a variable
        // that should be expanded
        if (seen.has(name)) return null
        let value = resolveVariableValue(state.designSystem, name)
        if (value !== null) {
          if (value.includes('var(')) {
            seen.add(name)
          }

          return value
        }
      }

      if (fallback) {
        return fallback
      }

      if (
        name === '--tw-text-shadow-alpha' ||
        name === '--tw-drop-shadow-alpha' ||
        name === '--tw-shadow-alpha'
      ) {
        return '100%'
      }

      // Don't touch it since there's no suitable replacement
      return null
    },
  })
}
