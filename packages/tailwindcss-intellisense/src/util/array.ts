export function dedupe<T>(arr: Array<T>): Array<T> {
  return arr.filter((value, index, self) => self.indexOf(value) === index)
}

export function dedupeBy<T>(
  arr: Array<T>,
  transform: (item: T) => any
): Array<T> {
  return arr.filter(
    (value, index, self) =>
      self.map(transform).indexOf(transform(value)) === index
  )
}

export function ensureArray<T>(value: T | T[]): T[] {
  return Array.isArray(value) ? value : [value]
}

export function flatten<T>(arrays: T[][]): T[] {
  return [].concat.apply([], arrays)
}

export function equal(arr1: any[], arr2: any[]): boolean {
  return (
    JSON.stringify(arr1.concat([]).sort()) ===
    JSON.stringify(arr2.concat([]).sort())
  )
}
