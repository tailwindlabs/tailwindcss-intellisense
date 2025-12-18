import type { SourceLocation } from './source'
import { parseAtRule } from './parse'

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
  nodes: AstNode[] | null

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

export function atRule(name: string, params: string = '', nodes: AstNode[] | null = []): AtRule {
  return {
    kind: 'at-rule',
    name,
    params,
    nodes,
  }
}

export function rule(selector: string, nodes: AstNode[] | null = []): StyleRule | AtRule {
  if (selector.charCodeAt(0) === AT_SIGN) {
    return parseAtRule(selector, nodes)
  }

  return styleRule(selector, nodes ?? [])
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
