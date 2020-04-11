export function stringifyConfigValue(x: any): string {
  if (typeof x === 'string') return x
  if (typeof x === 'number') return x.toString()
  if (Array.isArray(x)) {
    return x
      .filter(y => typeof y === 'string')
      .filter(Boolean)
      .join(', ')
  }
  return ''
}
