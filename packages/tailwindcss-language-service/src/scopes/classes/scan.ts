import { ScopeClassList } from '../scope'

export function scanClassList(input: string, scope: ScopeClassList) {
  let classList = input.slice(scope.source.scope[0], scope.source.scope[1])
  let parts = classList.split(/(\s+)/)

  let index = scope.source.scope[0]

  for (let i = 0; i < parts.length; i++) {
    let length = parts[i].length

    if (i % 2 === 0) {
      scope.children.push({
        kind: 'class.name',
        source: { scope: [index, index + length] },
        children: [],
      })
    }

    index += length
  }
}
