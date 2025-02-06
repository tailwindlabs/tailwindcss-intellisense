import type { Span } from './state'

export function spansEqual(a: Span, b: Span): boolean {
  return a[0] === b[0] && a[1] === b[1]
}
