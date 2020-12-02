import isObject from './isObject'

export type MinMaxScreen = {
  min?: string
  max?: string
}

export type RawScreen = {
  raw: string
}

export type Screen = string | RawScreen | MinMaxScreen | MinMaxScreen[]

function isRawScreen(screen: unknown): screen is RawScreen {
  return isObject(screen) && (screen as RawScreen).raw !== undefined
}

export function stringifyScreen(screen: Screen): string | undefined {
  if (!screen) return undefined
  if (typeof screen === 'string') return `@media (min-width: ${screen})`
  if (isRawScreen(screen)) {
    return `@media ${(screen as RawScreen).raw}`
  }
  let str = (Array.isArray(screen) ? screen : [screen])
    .map((range) => {
      return [
        typeof range.min === 'string' ? `(min-width: ${range.min})` : null,
        typeof range.max === 'string' ? `(max-width: ${range.max})` : null,
      ]
        .filter(Boolean)
        .join(' and ')
    })
    .join(', ')
  return str ? `@media ${str}` : undefined
}
