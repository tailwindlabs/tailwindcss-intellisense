import type { AnyScope, Scope, ScopeKind } from './scope'
import { walkScope, type ScopePath } from './walk'

/**
 * A tree of scopes that represent information about a document
 */
export class ScopeTree {
  /**
   * A list of "root" scopes in a document
   *
   * This list is guaranteed to be sorted in asending order
   *
   * TODO: This should be a single root ScopeContext that identifies the document as a whole
   */
  private roots: AnyScope[]

  /**
   * Preconditions:
   * - Scopes ascending order relative to their start pos, recursively
   * - Parent scopes entirely encapsulate their children
   * - No sibling scopes at any depth can overlap
   * - No scope may appear more than once in the tree
   * - No scope may be an ancestor of itself (i.e. no cycles)
   *
   * @param roots
   */
  constructor(roots: AnyScope[] = []) {
    this.roots = roots
  }

  /**
   * Get the path to a specific scope in the tree if it exists
   */
  pathTo(scope: AnyScope): ScopePath {
    let path = this.at(scope.source.scope[0])
    return path.slice(0, path.indexOf(scope) + 1)
  }

  /**
   * Get the scope active at a specific position in the document
   *
   * For example, given this position in some HTML:
   * ```html
   * <div class="bg-blue-500 text-white">
   *                ^
   * ```
   *
   * We know the following scopes are active:
   * ```
   * `context` [0, 36]
   *   `class.attr` [12, 34]
   *     `class.list` [12, 34]
   *       `class.name` [12, 23]
   * ```
   *
   * The path to the inner-most active scope is returned:
   * - 0: `context` [0, 36]
   * - 1: `class.attr` [12, 34]
   * - 2: `class.list` [12, 34]
   * - 3: `class.name` [12, 23]
   */
  public at(pos: number): ScopePath {
    let path: ScopePath = []

    let nodes = this.roots

    next: while (true) {
      let low = 0
      let high = nodes.length - 1

      while (low <= high) {
        let mid = (low + high) >> 1
        let node = nodes[mid]

        let span = node.source.scope
        if (pos < span[0]) {
          high = mid - 1
        } else if (pos > span[1]) {
          low = mid + 1
        } else {
          // Record the scope and move to the next level
          path.push(node)
          nodes = node.children
          continue next
        }
      }

      break
    }

    return Array.from(path)
  }

  /**
   * Gets the inner-most scope of a specific kind active at a position
   */
  public closestAt<K extends ScopeKind>(kind: K, pos: number): Scope<K> | null {
    let path = this.at(pos)

    for (let i = path.length - 1; i >= 0; i--) {
      let scope = path[i]
      if (scope.kind === kind) return scope as Scope<K>
    }

    return null
  }

  /**
   * A list of all active scopes
   */
  public all(): AnyScope[] {
    return this.roots
  }

  /**
   * Return an ordered list of all scopes applied to the text
   */
  public description(text?: string): string {
    let indent = '  '

    let str = ''
    str += '\n'

    walkScope(this.roots, {
      enter(scope, { depth }) {
        let span = scope.source.scope

        str += indent.repeat(depth)
        str += '['
        str += span[0]
        str += ', '
        str += span[1]
        str += '] '
        str += scope.kind

        if (text) {
          str += ' "'

          let length = span[1] - span[0]

          if (length > 20) {
            str += text.slice(span[0], span[0] + 20).replaceAll('\n', '\\n')
            str += '...'
          } else {
            str += text.slice(span[0], span[1]).replaceAll('\n', '\\n')
          }

          str += '"'
        }

        str += '\n'
      },
    })

    str += '\n'

    return str
  }
}
