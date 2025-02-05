export type TailwindVersion = '3' | '4'

/**
 * Determine the likely Tailwind version used by the given file
 *
 * This returns an array of possible versions, as a file could contain
 * features that make determining the version ambiguous.
 *
 * The order *does* matter, as the first item is the most likely version.
 */
export function guessTailwindVersion(content: string): TailwindVersion[] {
  // It's likely this is a v4 file if it has a v4 import:
  // - `@import "tailwindcss"`
  // - `@import "tailwindcss/theme"
  // - etc…
  let HAS_V4_IMPORT = /@import\s*['"]tailwindcss(?:\/[^'"]+)?['"]/
  if (HAS_V4_IMPORT.test(content)) return ['4']

  // It's likely this is a v4 file if it has a v4-specific feature:
  // - @theme
  // - @plugin
  // - @utility
  // - @variant
  // - @custom-variant
  let HAS_V4_DIRECTIVE = /@(theme|plugin|utility|custom-variant|variant|reference)\s*[^;{]+[;{]/
  if (HAS_V4_DIRECTIVE.test(content)) return ['4']

  // It's likely this is a v4 file if it's using v4's custom functions:
  // - --alpha(…)
  // - --spacing(…)
  // - --theme(…)
  let HAS_V4_FN = /--(alpha|spacing|theme)\(/
  if (HAS_V4_FN.test(content)) return ['4']

  // If the file contains older `@tailwind` directives, it's likely a v3 file
  let HAS_LEGACY_TAILWIND = /@tailwind\s*(base|preflight|components|variants|screens)+;/
  if (HAS_LEGACY_TAILWIND.test(content)) return ['3']

  // If the file contains other `@tailwind` directives it might be either
  let HAS_TAILWIND = /@tailwind\s*[^;]+;/
  if (HAS_TAILWIND.test(content)) return ['4', '3']

  // If the file contains other `@apply` or `@config` it might be either
  let HAS_COMMON_DIRECTIVE = /@(config|apply)\s*[^;{]+[;{]/
  if (HAS_COMMON_DIRECTIVE.test(content)) return ['4', '3']

  // If it's got imports at all it could be either
  let HAS_IMPORT = /@import\s*['"]/
  if (HAS_IMPORT.test(content)) return ['4', '3']

  // There's chance this file isn't tailwind-related
  return []
}
