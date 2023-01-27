export function naturalExpand(value: number, total?: number): string {
  let length = typeof total === 'number' ? total.toString().length : 8
  return ('0'.repeat(length) + value).slice(-length)
}
