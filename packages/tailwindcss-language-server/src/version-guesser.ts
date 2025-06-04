export type TailwindVersion = '3' | '4'

export interface TailwindStylesheet {
  /**
   * Whether or not this file can be used as a project root
   */
  root: boolean

  /**
   * The likely Tailwind version used by the given file
   */
  versions: TailwindVersion[]

  /**
   * Whether or not this stylesheet explicitly imports Tailwind CSS
   */
  explicitImport: boolean
}

// It's likely this is a v4 file if it has a v4 import:
// - `@import "tailwindcss"`
// - `@import "tailwindcss/theme"
// - etc…
const HAS_V4_IMPORT = /@import\s*['"]tailwindcss(?:\/[^'"]+)?['"]/

// It's likely this is a v4 file if it has a v4-specific feature:
// - @plugin
// - @utility
// - @variant
// - @custom-variant
const HAS_V4_DIRECTIVE = /@(theme|plugin|utility|custom-variant|variant|reference)\s*[^;{]+[;{]/

// It's likely this is a v4 file if it's using v4's custom functions:
// - --alpha(…)
// - --spacing(…)
// - --theme(…)
const HAS_V4_FN = /--(alpha|spacing|theme)\(/

// If the file contains older `@tailwind` directives, it's likely a v3 file
const HAS_LEGACY_TAILWIND = /@tailwind\s*(base|preflight|components|variants|screens)+;/

// If the file contains other `@tailwind` directives it might be either
const HAS_TAILWIND_UTILITIES = /@tailwind\s*utilities\s*[^;]*;/

// If the file contains other `@tailwind` directives it might be either
const HAS_TAILWIND = /@tailwind\s*[^;]+;/

// If the file contains other `@apply` or `@config` it might be either
const HAS_COMMON_DIRECTIVE = /@(config|apply)\s*[^;{]+[;{]/

// If it's got imports at all it could be either
// Note: We only care about non-url imports
const HAS_NON_URL_IMPORT = /@import\s*['"](?!([a-z]+:|\/\/))/

/**
 * Determine the likely Tailwind version used by the given file
 *
 * This returns an array of possible versions, as a file could contain
 * features that make determining the version ambiguous.
 *
 * The order *does* matter, as the first item is the most likely version.
 */
export function analyzeStylesheet(content: string): TailwindStylesheet {
  // An import for v4 definitely means it can be a v4 root
  if (HAS_V4_IMPORT.test(content)) {
    return {
      root: true,
      versions: ['4'],
      explicitImport: true,
    }
  }

  // Having v4-specific directives means its related but not necessarily a root
  // but having `@tailwind utilities` alongside it means it could be
  if (HAS_V4_DIRECTIVE.test(content)) {
    // Unless it specifically has `@tailwind utilities` in it
    if (HAS_TAILWIND_UTILITIES.test(content)) {
      return {
        root: true,
        versions: ['4'],
        explicitImport: false,
      }
    }

    return {
      // This file MUST be imported by another file to be a valid root
      root: false,
      versions: ['4'],
      explicitImport: false,
    }
  }

  // Just having v4 functions doesn't mean it's a v4 root
  if (HAS_V4_FN.test(content)) {
    return {
      // This file MUST be imported by another file to be a valid root
      root: false,
      versions: ['4'],
      explicitImport: false,
    }
  }

  // Legacy tailwind directives mean it's a v3 file
  if (HAS_LEGACY_TAILWIND.test(content)) {
    return {
      // Roots are only a valid concept in v4
      root: false,
      versions: ['3'],
      explicitImport: false,
    }
  }

  // Other tailwind directives could be either (though they're probably invalid)
  if (HAS_TAILWIND.test(content)) {
    return {
      root: true,
      versions: ['4', '3'],
      explicitImport: false,
    }
  }

  // Other common directives could be either but don't signal a root file
  if (HAS_COMMON_DIRECTIVE.test(content)) {
    return {
      root: false,
      versions: ['4', '3'],
      explicitImport: false,
    }
  }

  // Files that import other files could be either and are potentially roots
  if (HAS_NON_URL_IMPORT.test(content)) {
    return {
      root: true,
      versions: ['4', '3'],
      explicitImport: false,
    }
  }

  // Pretty sure it's not related to Tailwind at all
  return {
    root: false,
    versions: [],
    explicitImport: false,
  }
}
