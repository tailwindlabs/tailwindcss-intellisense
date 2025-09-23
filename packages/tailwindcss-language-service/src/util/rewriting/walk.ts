import { ComponentValue, isFunctionNode, isSimpleBlockNode } from '@csstools/css-parser-algorithms'

export interface VisitFn {
  (value: ComponentValue, siblings: ComponentValue[]): ComponentValue[] | null
}

export interface Visitor {
  enter?: VisitFn
  exit?: VisitFn
}

export function walk(list: ComponentValue[], visit: Visitor): void {
  let seen = new Set<ComponentValue>()

  for (let i = 0; i < list.length; ++i) {
    let node = list[i]
    if (seen.has(node)) continue
    seen.add(node)

    let replacement = visit.enter?.(node, list)

    // If the nodes have been replaced then we need to visit the new nodes
    // before visiting children
    if (replacement) {
      list.splice(i, 1, ...replacement)
      i -= 1
      continue
    }

    if (isFunctionNode(node) || isSimpleBlockNode(node)) {
      walk(node.value, visit)
    }

    replacement = visit.exit?.(node, list)

    // If the nodes have been replace then we need to visit the new nodes
    // before visiting children
    if (replacement) {
      list.splice(i, 1, ...replacement)
      i -= 1
      continue
    }
  }
}
