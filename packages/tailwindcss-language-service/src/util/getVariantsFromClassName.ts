import type { State } from './state'
import * as jit from './jit'
import { segment } from './segment'

export function getVariantsFromClassName(
  state: State,
  className: string,
): { variants: string[]; offset: number } {
  let allVariants = state.variants.flatMap((variant) => {
    if (variant.values.length) {
      return variant.values.map((value) =>
        value === 'DEFAULT' ? variant.name : `${variant.name}${variant.hasDash ? '-' : ''}${value}`,
      )
    }
    return [variant.name]
  })

  let parts = segment(className, state.separator)
  if (parts.length < 2) {
    return { variants: [], offset: 0 }
  }

  parts = parts.filter(Boolean)

  function isValidVariant(part: string) {
    if (allVariants.includes(part)) {
      return true
    }

    let className = `${part}${state.separator}[color:red]`

    if (state.v4) {
      // NOTE: This should never happen
      if (!state.designSystem) return false

      let prefix = state.designSystem.theme.prefix ?? ''

      if (prefix !== '') {
        className = `${prefix}:${className}`
      }

      // We don't use `compile()` so there's no overhead from PostCSS
      let compiled = state.designSystem.candidatesToCss([className])

      // NOTE: This should never happen
      if (compiled.length !== 1) return false

      return compiled[0] !== null
    }

    if (state.jit) {
      if ((part.includes('[') && part.endsWith(']')) || part.includes('/')) {
        return jit.generateRules(state, [className]).rules.length > 0
      }
    }

    return false
  }

  let offset = 0
  let variants = new Set<string>()

  for (let part of parts) {
    if (!isValidVariant(part)) break

    variants.add(part)
    offset += part.length + state.separator!.length
  }

  return { variants: Array.from(variants), offset }
}
