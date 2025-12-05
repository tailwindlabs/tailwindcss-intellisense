import { parseAtRule } from './parse'
import type { SourceLocation } from './source'
import type { VisitContext } from '../util/walk'

const AT_SIGN = 0x40

export type StyleRule = {
  kind: 'rule'
  selector: string
  nodes: AstNode[]

  src?: SourceLocation
  dst?: SourceLocation
}

export type AtRule = {
  kind: 'at-rule'
  name: string
  params: string
  nodes: AstNode[]

  src?: SourceLocation
  dst?: SourceLocation
}

export type Declaration = {
  kind: 'declaration'
  property: string
  value: string | undefined
  important: boolean

  src?: SourceLocation
  dst?: SourceLocation
}

export type Comment = {
  kind: 'comment'
  value: string

  src?: SourceLocation
  dst?: SourceLocation
}

export type Context = {
  kind: 'context'
  context: Record<string, string | boolean>
  nodes: AstNode[]

  src?: undefined
  dst?: undefined
}

export type AtRoot = {
  kind: 'at-root'
  nodes: AstNode[]

  src?: undefined
  dst?: undefined
}

export type Rule = StyleRule | AtRule
export type AstNode = StyleRule | AtRule | Declaration | Comment | Context | AtRoot
export type Stylesheet = AstNode[]

export function styleRule(selector: string, nodes: AstNode[] = []): StyleRule {
  return {
    kind: 'rule',
    selector,
    nodes,
  }
}

export function atRule(name: string, params: string = '', nodes: AstNode[] = []): AtRule {
  return {
    kind: 'at-rule',
    name,
    params,
    nodes,
  }
}

export function rule(selector: string, nodes: AstNode[] = []): StyleRule | AtRule {
  if (selector.charCodeAt(0) === AT_SIGN) {
    return parseAtRule(selector, nodes)
  }

  return styleRule(selector, nodes)
}

export function decl(property: string, value: string | undefined, important = false): Declaration {
  return {
    kind: 'declaration',
    property,
    value,
    important,
  }
}

export function comment(value: string): Comment {
  return {
    kind: 'comment',
    value: value,
  }
}

export function context(context: Record<string, string | boolean>, nodes: AstNode[]): Context {
  return {
    kind: 'context',
    context,
    nodes,
  }
}

export function atRoot(nodes: AstNode[]): AtRoot {
  return {
    kind: 'at-root',
    nodes,
  }
}

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
        nodes: node.nodes.map(cloneAstNode),
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
