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

  for (let [index, part] of parts.entries()) {
    // If we see an empty variant it's because:
    //
    // - The string contains consecutive top-level separators, e.g.
    //   hover::flex
    // - The string *ends* with a `:` which is a signal that the variant is done
    //   and more should be suggested

    // The first case isn't a valid class, partial or otherwise. The second one
    // *is* valid because a user is probably in the middle of typing a utility.
    //
    // In both situations a `break` is sufficient to signal that the remainder
    // of the string should be ignored when determining variants.
    if (part === '') break
    if (!isValidVariant(part)) break

    variants.add(part)

    offset += part.length

    // All variants must be succeeded by the separator (`:`) when used in a
    // utility. However, Tailwind CSS <= v4.1.15 has a bug where we consider
    // `bg-[` valid because we try to compile `bg-[:[color:red]` which in turn
    // parses as a valid class when it obviously is not.
    //
    // To combat this we've done two things:
    // - Add the offset to all variants *except* the last one
    // - Allow an empty string in the last position to account for situations
    //   where a utility name is currently being typed (e.g. `hover:`)
    offset += index < parts.length - 1 ? state.separator!.length : 0
  }

  return { variants: Array.from(variants), offset }
}
