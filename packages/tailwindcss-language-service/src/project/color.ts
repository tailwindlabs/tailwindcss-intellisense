// FIXME: This is a performance optimization and not strictly correct
let isNegative = /^-/
let isNumericUtility =
  /^-?((min-|max-)?[wh]|z|start|order|opacity|rounded|row|col|size|basis|end|duration|ease|font|top|left|bottom|right|inset|leading|cursor|(space|scale|skew|rotate)-[xyz]|gap(-[xy])?|(scroll-)?[pm][trblxyse]?)-/
let isMaskUtility = /^-?mask-/

export function mayContainColors(className: string) {
  if (isNegative.test(className)) return false
  // TODO: This is **not** correct but is intentional because there are 5k mask utilities and a LOT of them are colors
  // This causes a massive slowdown when building the design system
  if (isMaskUtility.test(className)) return false
  if (isNumericUtility.test(className)) return false

  return true
}
