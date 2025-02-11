import type { AnyScope } from './scope'

/**
 * The path from the root up to and including the active scope
 */
export type ScopePath = AnyScope[]

export interface ScopeUtils {
  path: ScopePath
  depth: number
}

export interface ScopeVisitorFn<T = void> {
  (scope: AnyScope, utils: ScopeUtils): T
}

export interface ScopeVisitor<T = void> {
  enter?: ScopeVisitorFn<T>
  exit?: ScopeVisitorFn<T>
}

export function walkScope(
  node: AnyScope | Iterable<AnyScope>,
  visit: ScopeVisitor,
  path: ScopePath = [],
): void {
  let roots = Array.isArray(node) ? node : [node]

  for (let node of roots) {
    let utils: ScopeUtils = {
      path,
      depth: path.length,
    }

    path.push(node)
    visit.enter?.(node, utils)
    utils.depth += 1
    for (let child of node.children) {
      walkScope(child, visit, path)
    }
    utils.depth -= 1
    visit.exit?.(node, utils)
    path.pop()
  }
}

export function optimizeScopes(nodes: AnyScope[]) {
  nestSiblings(nodes)
  eliminateScopes(nodes)
}

/**
 * Eliminate unncessary scopes from the tree
 *
 * TODO: The parsing should become smarter and this function should be removed
 */
export function eliminateScopes(nodes: AnyScope[]): AnyScope[] {
  walkScope(nodes, {
    enter(scope, { path }) {
      if (scope.kind !== 'css.fn') return

      let parent = path[path.length - 2]

      if (!parent) return
      if (parent.kind !== 'css.at-rule.import') return

      parent.children.splice(parent.children.indexOf(scope), 1, ...scope.children)
    },
  })

  return nodes
}

/**
 * Convert siblings nodes into children of previous nodes if they are contained within them
 */
export function nestSiblings(nodes: AnyScope[]) {
  nodes.sort((a, z) => {
    return a.source.scope[0] - z.source.scope[0] || z.source.scope[1] - a.source.scope[1]
  })

  walkScope(nodes, {
    enter(scope) {
      // Sort the children to guarantee parents appear before children
      scope.children.sort((a, z) => {
        return a.source.scope[0] - z.source.scope[0] || z.source.scope[1] - a.source.scope[1]
      })

      let children = scope.children
      if (children.length <= 1) return

      for (let i = children.length - 1; i > 0; i--) {
        let current = children[i]

        // Find the closest containing parent
        for (let j = i - 1; j >= 0; j--) {
          let potential = children[j]

          if (
            current.source.scope[0] >= potential.source.scope[0] &&
            current.source.scope[1] <= potential.source.scope[1]
          ) {
            // Remove the current node
            children.splice(i, 1)

            // and insert it as the child of the containing node
            potential.children.push(current)

            // Stop after finding the first containing parent
            break
          }
        }
      }
    },
  })
}

/**
 * Convert a list of scopes to a string representation
 */
export function printScopes(nodes: AnyScope[], text?: string) {
  let indent = '  '

  let str = ''
  str += '\n'

  function printText(span: [number, number]) {
    str += '"'

    let length = span[1] - span[0]

    if (length > 20) {
      str += text!.slice(span[0], span[0] + 20).replaceAll('\n', '\\n')
      str += '...'
    } else {
      str += text!.slice(span[0], span[1]).replaceAll('\n', '\\n')
    }

    str += '"'
  }

  walkScope(nodes, {
    enter(scope, { depth }) {
      let span = scope.source.scope

      str += indent.repeat(depth)
      str += scope.kind

      str += ' ['
      str += span[0]
      str += '-'
      str += span[1]
      str += ']:'

      if (text) {
        str += ' '
        printText(span)
      }

      str += '\n'

      for (let [name, span] of Object.entries(scope.source)) {
        if (name === 'scope') continue

        str += indent.repeat(depth + 1)
        str += '- '
        str += name
        str += ' '

        if (span === null) {
          str += '(none)'
          str += '\n'
          continue
        }

        str += '['
        str += span[0]
        str += '-'
        str += span[1]
        str += ']:'

        if (text) {
          str += ' '
          printText(span)
        }

        str += '\n'
      }

      let meta: Record<string, unknown> = 'meta' in scope ? scope.meta : {}

      for (let [name, value] of Object.entries(meta)) {
        str += indent.repeat(depth + 1)
        str += '- '
        str += name
        str += ': '
        str += value
        str += '\n'
      }
    },
  })

  return str
}
