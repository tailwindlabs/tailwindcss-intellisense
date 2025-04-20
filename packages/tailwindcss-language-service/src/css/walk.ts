import { AstNode } from './ast'

export const enum WalkAction {
  /** Continue walking, which is the default */
  Continue,

  /** Skip visiting the children of this node */
  Skip,

  /** Stop the walk entirely */
  Stop,
}

export interface VisitorMeta {
  path: AstNode[]
  parent: AstNode | null
  context: Record<string, string | boolean>

  replaceWith(newNode: AstNode | AstNode[]): void
}

export interface Visitor {
  enter?(node: AstNode, meta: VisitorMeta): WalkAction
  exit?(node: AstNode, meta: VisitorMeta): WalkAction
}

export function walk(
  ast: AstNode[],
  visit: Visitor,
  path: AstNode[] = [],
  context: Record<string, string | boolean> = {},
) {
  for (let i = 0; i < ast.length; i++) {
    let node = ast[i]
    let parent = path[path.length - 1] ?? null

    let meta: VisitorMeta = {
      parent,
      context,
      path,
      replaceWith(newNode) {
        ast[i] = {
          kind: 'context',
          context: {},
          nodes: Array.isArray(newNode) ? newNode : [newNode],
        }
      },
    }

    path.push(node)
    let status = visit.enter?.(node, meta) ?? WalkAction.Continue
    path.pop()

    // Stop the walk entirely
    if (status === WalkAction.Stop) return WalkAction.Stop

    // Skip visiting the children of this node
    if (status === WalkAction.Skip) continue

    // These nodes do not have children
    if (node.kind === 'comment' || node.kind === 'declaration') continue

    let nodeContext = node.kind === 'context' ? { ...context, ...node.context } : context

    path.push(node)
    status = walk(node.nodes, visit, path, nodeContext)
    path.pop()

    if (status === WalkAction.Stop) return WalkAction.Stop

    path.push(node)
    status = visit.exit?.(node, meta) ?? WalkAction.Continue
    path.pop()

    if (status === WalkAction.Stop) return WalkAction.Stop
  }

  return WalkAction.Continue
}
