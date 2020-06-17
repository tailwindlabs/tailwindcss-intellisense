import { State } from './state'
const dlv = require('dlv')

export function getClassNameParts(state: State, className: string): string[] {
  let separator = state.separator
  className = className.replace(/^\./, '')
  let parts: string[] = className.split(separator)

  if (parts.length === 1) {
    return dlv(state.classNames.classNames, [className, '__rule']) === true ||
      Array.isArray(dlv(state.classNames.classNames, [className]))
      ? [className]
      : null
  }

  let points = combinations('123456789'.substr(0, parts.length - 1)).map((x) =>
    x.split('').map((x) => parseInt(x, 10))
  )

  let possibilities: string[][] = [
    [className],
    ...points.map((p) => {
      let result = []
      let i = 0
      p.forEach((x) => {
        result.push(parts.slice(i, x).join('-'))
        i = x
      })
      result.push(parts.slice(i).join('-'))
      return result
    }),
  ]

  return possibilities.find((key) => {
    if (
      dlv(state.classNames.classNames, [...key, '__rule']) === true ||
      Array.isArray(dlv(state.classNames.classNames, [...key]))
    ) {
      return true
    }
    return false
  })
}

function combinations(str: string): string[] {
  let fn = function (active: string, rest: string, a: string[]) {
    if (!active && !rest) return
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
