import { DesignSystem } from '../v4'

// Resolve a variable value from the design system
export function resolveVariableValue(design: DesignSystem, name: string) {
  return design.resolveThemeValue?.(name) ?? null
}
