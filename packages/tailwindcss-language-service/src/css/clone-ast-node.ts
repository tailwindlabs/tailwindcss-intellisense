import type { AstNode, AtRoot, AtRule, Comment, Context, Declaration, StyleRule } from './ast'

export function cloneAstNode<T extends AstNode>(node: T): T {
  switch (node.kind) {
    case 'rule':
      return {
        kind: node.kind,
        selector: node.selector,
        nodes: node.nodes.map(cloneAstNode),
        src: node.src,
        dst: node.dst,
      } satisfies StyleRule as T

    case 'at-rule':
      return {
        kind: node.kind,
        name: node.name,
        params: node.params,
        nodes: node.nodes?.map(cloneAstNode) ?? null,
        src: node.src,
        dst: node.dst,
      } satisfies AtRule as T

    case 'at-root':
      return {
        kind: node.kind,
        nodes: node.nodes.map(cloneAstNode),
        src: node.src,
        dst: node.dst,
      } satisfies AtRoot as T

    case 'context':
      return {
        kind: node.kind,
        context: { ...node.context },
        nodes: node.nodes.map(cloneAstNode),
        src: node.src,
        dst: node.dst,
      } satisfies Context as T

    case 'declaration':
      return {
        kind: node.kind,
        property: node.property,
        value: node.value,
        important: node.important,
        src: node.src,
        dst: node.dst,
      } satisfies Declaration as T

    case 'comment':
      return {
        kind: node.kind,
        value: node.value,
        src: node.src,
        dst: node.dst,
      } satisfies Comment as T

    default:
      node satisfies never
      throw new Error(`Unknown node kind: ${(node as any).kind}`)
  }
}
