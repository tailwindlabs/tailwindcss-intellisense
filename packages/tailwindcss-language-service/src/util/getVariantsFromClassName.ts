import { State } from './state'

export function getVariantsFromClassName(
  state: State,
  className: string
): { variants: string[]; offset: number } {
  let str = className
  let allVariants = Object.keys(state.variants)
  let allVariantsByLength = allVariants.sort((a, b) => b.length - a.length)
  let variants = new Set<string>()
  let offset = 0

  while (str) {
    let found = false
    for (let variant of allVariantsByLength) {
      if (str.startsWith(variant + state.separator)) {
        variants.add(variant)
        str = str.substr(variant.length + state.separator.length)
        offset += variant.length + state.separator.length
        found = true
        break
      }
    }
    if (!found) str = ''
  }

  return { variants: Array.from(variants), offset }
}
