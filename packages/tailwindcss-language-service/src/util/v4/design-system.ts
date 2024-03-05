import postcss from 'postcss'
import type { AstNode, Rule } from './ast'
import type { NamedVariant } from './candidate'

export interface Theme {}

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

export interface DesignSystem {
  theme: Theme
  variants: Map<string, VariantFn>
  utilities: Map<string, unknown>
  candidatesToCss(classes: string[]): (string | null)[]
  getClassOrder(classes: string[]): [string, bigint | null][]
  getClassList(): ClassEntry[]
  getVariants(): VariantEntry[]
}

export interface DesignSystem {
  compile(classes: string[]): postcss.Root[]
  toCss(nodes: postcss.Root | postcss.Node[]): string
  optimizeCss(css: string): string
}
