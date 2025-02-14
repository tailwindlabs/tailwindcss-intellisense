import postcss from 'postcss'
import type { Rule } from './ast'
import type { NamedVariant } from './candidate'

export interface Theme {
  // Prefix didn't exist for earlier Tailwind versions
  prefix?: string
  entries(): [string, any][]
}

export interface ClassMetadata {
  modifiers: string[]
  deprecated?: boolean
}

export interface VariantMetadata {
  deprecated?: boolean
}

export interface ThemeMetadata {
  deprecated?: boolean
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

export interface DesignSystem {
  theme: Theme
  variants: Map<string, VariantFn>
  utilities: Map<string, unknown>
  candidatesToCss(classes: string[]): (string | null)[]
  getClassOrder(classes: string[]): [string, bigint | null][]
  getClassList(): ClassEntry[]
  getVariants(): VariantEntry[]

  // Optional because it did not exist in earlier v4 alpha versions
  resolveThemeValue?(path: string): string | undefined
  classMetadata?(classes: string[]): (ClassMetadata | null)[]
  variantMetadata?(variants: string[]): (VariantMetadata | null)[]
  themeMetadata?(keys: string[]): (ThemeMetadata | null)[]
}

export interface DesignSystem {
  dependencies(): Set<string>
  compile(classes: string[]): postcss.Root[]
  toCss(nodes: postcss.Root | postcss.Node[]): string
}
