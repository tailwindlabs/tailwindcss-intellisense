import type { VisitContext } from '../util/walk'
import type { AstNode } from './ast'

export function cssContext(
  ctx: VisitContext<AstNode>,
): VisitContext<AstNode> & { context: Record<string, string | boolean> } {
  return {
    depth: ctx.depth,
    get context() {
      let context: Record<string, string | boolean> = {}
      for (let child of ctx.path()) {
        if (child.kind === 'context') {
          Object.assign(context, child.context)
        }
      }

      // Once computed, we never need to compute this again
      Object.defineProperty(this, 'context', { value: context })
      return context
    },
    get parent() {
      let parent = (this.path().pop() as Extract<AstNode, { nodes: AstNode[] }>) ?? null

      // Once computed, we never need to compute this again
      Object.defineProperty(this, 'parent', { value: parent })
      return parent
    },
    path() {
      return ctx.path().filter((n) => n.kind !== 'context')
    },
  }
}
