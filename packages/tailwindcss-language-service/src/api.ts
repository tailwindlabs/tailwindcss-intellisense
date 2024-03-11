import type { Color } from 'culori'
import type { Feature } from './features'
import postcss from 'postcss'

type KeywordColor = 'transparent' | 'currentcolor'

export interface ClassEntry {
  readonly kind: 'class'

  // The name of the class
  readonly name: string

  // The list of variants in this class
  readonly variants: readonly string[]

  // The PostCSS Root for the CSS this class generates
  readonly root: postcss.Root

  // The color(s) this class generates
  readonly colors: readonly (Color | KeywordColor)[]

  // A list of known, allowed modifiers for this class
  // This list is empty when:
  // - Modifiers are not supported by the given version of Tailwind
  // - The class does not support any modifiers
  // - The class _already_ includes a modifier
  readonly modifiers: readonly string[]

  // Whether or not this class can be used with apply
  readonly apply: { allowed: true } | { allowed: false; reason: string }
}

export interface CustomPropertyEntry {
  readonly kind: 'custom-property'

  // The name of the custom CSS property
  // Includes the leading `--`
  readonly name: string

  // Whether or not a value is required for this property
  readonly requiresValue: boolean
}

export interface ClassConflict {
  // The name of the class
  readonly name: string

  // The list of conflicts this class has
  readonly conflicts: readonly PropertyConflict[]
}

export interface PropertyConflict {
  // The conflicting classes
  readonly classes: readonly string[]

  // The properties that cause the conflict
  readonly properties: readonly string[]
}

export interface Api {
  /**
   * The version of Tailwind in use
   */
  readonly version: string

  /**
   * The list of supported features
   */
  readonly features: Feature[]

  /**
   * Perform any one-time setup required to use the API
   */
  prepare(): Promise<void>

  /**
   * Get information about a given list of classes.
   *
   * - Postcondition: Unknown classes are represented as `null`.
   * - Postcondition: The returned list is the same length and in the same order as `classes`.
   */
  queryClasses(classes: string[]): Promise<(ClassEntry | null)[]>

  /**
   * Get information about a list of CSS properties.
   *
   * - Postcondition: Unknown properties are represented as `null`.
   * - Postcondition: The returned list is the same length and in the same order as `properties`.
   */
  queryProperties(properties: string[]): Promise<(CustomPropertyEntry | null)[]>

  /**
   * Return a list of classes that may match the given query
   * This is generally a prefix search on a given class part (e.g. "bg-" or "red-")
   *
   * - Postcondition: Only known classes are returned.
   */
  searchClasses(query: string): Promise<ClassEntry[]>

  /**
   * Return a list of properties that may match the given query
   *
   * - Postcondition: Only known properties / namespaces are returned.
   */
  searchProperties(query: string): Promise<CustomPropertyEntry[]>

  /**
   * Sort the given list of classes.
   *
   * - Postcondition: The returned list is the same length as `classes`.
   * - Postcondition: Unknown classes are kept in their original, relative order
   *                  but are moved to the beginning of the list.
   */
  sort(classes: string[]): Promise<string[]>

  /**
   * Determine if any classes in the given list in conflict with one another.
   *
   * - Postcondition: The returned list is the same length and in the same order as `classes`.
   */
  conflicts(classes: string[]): Promise<ClassConflict[]>
}
