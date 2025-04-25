import { DesignSystem } from '../v4'

// Resolve a variable value from the design system
export function resolveVariableValue(design: DesignSystem, name: string): string | null {
  let prefix = design.theme.prefix ?? null

  if (prefix && name.startsWith(`--${prefix}`)) {
    name = `--${name.slice(prefix.length + 3)}`
  }

  return design.resolveThemeValue?.(name, true) ?? null
}
