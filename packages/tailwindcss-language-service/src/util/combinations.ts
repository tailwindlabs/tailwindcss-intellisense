export function combinations(str: string): string[] {
  let fn = function (active: string, rest: string, a: string[]) {
    if (!active && !rest) return undefined
    if (!rest) {
      a.push(active)
    } else {
      fn(active + rest[0], rest.slice(1), a)
      fn(active, rest.slice(1), a)
    }
    return a
  }
  return fn('', str, [])
}
