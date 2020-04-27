function pad(n: string): string {
  return ('00000000' + n).substr(-8)
}

export function naturalExpand(value: number | string): string {
  let str = typeof value === 'string' ? value : value.toString()
  return str.replace(/\d+/g, pad)
}
