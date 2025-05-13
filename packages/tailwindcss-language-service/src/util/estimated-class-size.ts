import { segment } from './segment'

/**
 * Calculates the approximate size of a generated class
 *
 * This is meant to be a lower bound, as the actual size of a class can vary
 * depending on the actual CSS properties and values, configured theme, etc…
 */
export function estimatedClassSize(className: string): number {
  let size = 0

  // We estimate the size using the following structure which gives a reasonable
  // lower bound on the size of the generated CSS:
  //
  // .class-name {
  //   &:variant-1 {
  //     &:variant-2 {
  //       …
  //     }
  //   }
  // }

  // Class name
  size += 1 + className.length + 3
  size += 2

  // Variants + nesting
  for (let [depth, variantName] of segment(className, ':').entries()) {
    size += (depth + 1) * 2 + 2 + variantName.length + 3
    size += (depth + 1) * 2 + 2
  }

  // ~1.95x is a rough growth factor due to the actual properties being present
  return size * 1.95
}
