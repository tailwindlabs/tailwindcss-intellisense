// https://www.codementor.io/@agustinchiappeberrini/lazy-evaluation-and-javascript-a5m7g8gs3

export interface Lazy<T> {
  (): T
  isLazy: boolean
}

export const lazy = <T>(getter: () => T): Lazy<T> => {
  let evaluated: boolean = false
  let _res: T = null
  const res = <Lazy<T>>function (): T {
    if (evaluated) return _res
    _res = getter.apply(this, arguments)
    evaluated = true
    return _res
  }
  res.isLazy = true
  return res
}
