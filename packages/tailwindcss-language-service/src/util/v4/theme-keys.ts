import { DesignSystem } from './design-system'

export function resolveKnownThemeKeys(design: DesignSystem): string[] {
  let validThemeKeys = Array.from(design.theme.entries(), ([key]) => key)

  let prefixLength = design.theme.prefix?.length ?? 0

  return prefixLength > 0
    ? // Strip the configured prefix from the list of valid theme keys
      validThemeKeys.map((key) => `--${key.slice(prefixLength + 3)}`)
    : validThemeKeys
}

export function resolveKnownThemeNamespaces(design: DesignSystem): string[] {
  return [
    '--breakpoint',
    '--color',
    '--animate',
    '--blur',
    '--radius',
    '--shadow',
    '--inset-shadow',
    '--drop-shadow',
    '--container',
    '--font',
    '--font-size',
    '--tracking',
    '--leading',
    '--ease',
  ]
}
