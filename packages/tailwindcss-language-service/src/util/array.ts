import type { Range } from 'vscode-languageserver'
import { rangesEqual } from './rangesEqual'

export function dedupe<T>(arr: Array<T>): Array<T> {
  return arr.filter((value, index, self) => self.indexOf(value) === index)
}

export function dedupeBy<T>(arr: Array<T>, transform: (item: T) => any): Array<T> {
  return arr.filter((value, index, self) => self.map(transform).indexOf(transform(value)) === index)
}

export function dedupeByRange<T extends { range: Range }>(arr: Array<T>): Array<T> {
  return arr.filter(
    (classList, classListIndex) =>
      classListIndex === arr.findIndex((c) => rangesEqual(c.range, classList.range)),
  )
}

export function ensureArray<T>(value: T | T[]): T[] {
  return Array.isArray(value) ? value : [value]
}

export function flatten<T>(arrays: T[][]): T[] {
  return [].concat.apply([], arrays)
}

export function equal(a: any[], b: any[]): boolean {
  if (a === b) return true
  if (a.length !== b.length) return false

  let aSorted = a.concat().sort()
  let bSorted = b.concat().sort()

  for (let i = 0; i < aSorted.length; ++i) {
    if (aSorted[i] !== bSorted[i]) return false
  }

  return true
}

export function equalExact(a: any[], b: any[]): boolean {
  if (a === b) return true
  if (a.length !== b.length) return false

  for (let i = 0; i < a.length; ++i) {
    if (a[i] !== b[i]) return false
  }

  return true
}
