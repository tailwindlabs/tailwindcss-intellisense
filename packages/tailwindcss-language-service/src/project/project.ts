import type { Feature } from '../features'
import type { ResolvedClass, ResolvedDesignToken, ResolvedVariant } from './tokens'
import { createProjectV4, type ProjectDescriptorV4 } from './v4'

export interface Project {
  /**
   * The version of Tailwind CSS used by this project
   */
  readonly version: string

  /**
   * The features supported by this version of Tailwind CSS
   *
   * @internal These values are not stable and may change at any point
   */
  readonly features: Feature[]

  /**
   * A list of files this project depends on. If any of these files change the
   * project must be re-created.
   *
   * These are normalized URIs
   */
  depdendencies: string[]

  /**
   * A list of glob patterns that represent known source / template paths
   *
   * v4.x, inferred from:
   * - `@source "…"`
   * - `@import "…" source(…)`
   * - `@tailwind utilities source(…)`
   * - `@config` -> `content` (compat)
   * - `@plugin` -> `content` (compat)
   *
   * v3.x, inferred from:
   * - `content`
   *
   * v2.x: always empty
   * v1.x: always empty
   * v0.x: always empty
   */
  sources(): ProjectSource[]

  /**
   * Get information about a given list of classes.
   *
   * - Postcondition: The returned list is the same length and in the same order as `classes`.
   * - Postcondition: Unknown classes have .source = 'unknown'
   */
  resolveClasses(classes: string[]): Promise<ResolvedClass[]>

  /**
   * Get information about a list of registered design tokens.
   *
   * - Postcondition: The returned list is the same length and in the same order as `tokens`.
   * - Postcondition: Unknown tokens have .source = 'unknown'
   */
  resolveDesignTokens(tokens: string[]): Promise<ResolvedDesignToken[]>

  /**
   * Get information about a given list of variants.
   *
   * - Postcondition: The returned list is the same length and in the same order as `variants`.
   * - Postcondition: Unknown classes have .source = 'unknown'
   */
  resolveVariants(variants: string[]): Promise<ResolvedVariant[]>

  /**
   * Return a list of classes that may match the given query
   * This is generally a prefix search on a given class part (e.g. "bg-" or "red-")
   *
   * - Postcondition: Only known classes are returned.
   */
  searchClasses(query: string): Promise<ResolvedClass[]>

  /**
   * Return a list of properties that may match the given query
   *
   * - Postcondition: Only known design tokens are returned.
   */
  searchDesignTokens(query: string): Promise<ResolvedDesignToken[]>

  /**
   * Return a list of variants that may match the given query
   * This is generally a prefix search on a given variant part (e.g. "data-" or "red-")
   *
   * - Postcondition: Only known variants are returned.
   */
  searchVariants(query: string): Promise<ResolvedVariant[]>

  /**
   * Sort the given list of classes.
   *
   * - Postcondition: The returned list is the same length as `classes`.
   * - Postcondition: Unknown classes are kept in their original, relative order
   *                  but are moved to the beginning of the list.
   */
  sortClasses(classes: string[]): Promise<string[]>
}

export interface ProjectSource {
  /**
   * The base (file) URI for this pattern
   */
  readonly base: string

  /**
   * The glob pattern to match against the base URI
   */
  readonly pattern: string

  /**
   * Whether or not this is a inverted/negative pattern
   */
  readonly negated: boolean
}

export type ProjectDescriptor = ProjectDescriptorV4

export function createProject(desc: ProjectDescriptor): Promise<Project> {
  if (desc.kind === 'v4') return createProjectV4(desc)

  throw new Error('Unknown project kind')
}
