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

  // Earlier v4 versions did not have this method
  getThemeEntries?(): ThemeEntry[]
}

export interface DesignSystem {
  compile(classes: string[]): postcss.Root[]
  toCss(nodes: postcss.Root | postcss.Node[]): string
}
