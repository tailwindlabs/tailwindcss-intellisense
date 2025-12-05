import postcss from 'postcss'
import type { NamedVariant } from './candidate'
import type { AstNode, Rule } from '../../css'

export interface Theme {
  // Prefix didn't exist for earlier Tailwind versions
  prefix?: string
  entries(): [string, any][]
}

export interface ClassMetadata {
  modifiers: string[]
}

export type ClassEntry = [string, ClassMetadata]

export interface VariantEntry {
  name: string
  isArbitrary: boolean
  values: string[]
  hasDash: boolean
  selectors: (options: { modifier?: string; value?: string }) => string[]
}

export type VariantFn = (rule: Rule, variant: NamedVariant) => null | void

export interface ThemeEntry {
  kind: 'namespace' | 'variable'
  name: string
}

export interface CanonicalizeOptions {
  rem?: number
}

export interface DesignSystem {
  theme: Theme
  variants: Map<string, VariantFn>
  utilities: Map<string, unknown>
  candidatesToCss(classes: string[]): (string | null)[]
  getClassOrder(classes: string[]): [string, bigint | null][]
  getClassList(): ClassEntry[]
  getVariants(): VariantEntry[]

  // Added in v4.0.0-alpha.24
  resolveThemeValue?(path: string, forceInline?: boolean): string | undefined

  // Added in v4.0.0-alpha.26
  invalidCandidates?: Set<string>

  // Added in v4.1.15
  canonicalizeCandidates?(classes: string[], options?: CanonicalizeOptions): string[]

  // Added in v4.1.16
  // We can patch it into any design system if it doesn't exist though
  storage?: Record<symbol, any>

  // Added in v4.1.18
  candidatesToAst?(classes: string[]): AstNode[][]
}

export interface DesignSystem {
  dependencies(): Set<string>
  compile(classes: string[]): AstNode[][]
}
