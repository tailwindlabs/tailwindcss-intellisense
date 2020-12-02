import { State } from './state'
import { combinations } from './combinations'
const dlv = require('dlv')

export function getClassNameParts(state: State, className: string): string[] {
  let separator = state.separator
  className = className.replace(/^\./, '')
  let parts: string[] = className.split(separator)

  if (parts.length === 1) {
    return dlv(state.classNames.classNames, [className, '__info', '__rule']) ===
      true ||
      Array.isArray(dlv(state.classNames.classNames, [className, '__info']))
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
      dlv(state.classNames.classNames, [...key, '__info', '__rule']) === true ||
      Array.isArray(dlv(state.classNames.classNames, [...key, '__info']))
    ) {
      return true
    }
    return false
  })
}
