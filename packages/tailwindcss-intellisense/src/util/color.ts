import { TinyColor, names as colorNames } from '@ctrl/tinycolor'

export function getColorFromValue(value: unknown): string {
  if (typeof value !== 'string') return null
  const trimmedValue = value.trim()
  if (trimmedValue === 'transparent') {
    return 'rgba(0, 0, 0, 0.01)'
  }
  if (
    !/^\s*(?:rgba?|hsla?)\s*\([^)]+\)\s*$/.test(trimmedValue) &&
    !/^\s*#[0-9a-f]+\s*$/i.test(trimmedValue) &&
    !Object.keys(colorNames).includes(trimmedValue)
  ) {
    return null
  }
  const color = new TinyColor(trimmedValue)
  if (color.isValid) {
    return color.toRgbString()
  }
  return null
}
