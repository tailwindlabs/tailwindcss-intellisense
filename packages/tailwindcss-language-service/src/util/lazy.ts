export interface Lazy<T> {
  status: 'pending' | 'fulfilled'

  (...args: unknown[]): T
}

export function lazy<T>(getter: () => T): Lazy<T> {
  let result: { value: T } | undefined

  function get(): T {
    result ??= { value: getter() }
    return result.value
  }

  return Object.defineProperties(get as Lazy<T>, {
    status: {
      get: () => (result ? 'fulfilled' : 'pending'),
    },
  })
}
