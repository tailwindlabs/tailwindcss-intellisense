import type * as postcss from 'postcss'
import { atRule, comment, decl, styleRule, type AstNode } from './ast'
import type { Source, SourceLocation } from './source'
import { DefaultMap } from '../util/default-map'

const EXCLAMATION_MARK = 0x21

export function fromPostCSSAst(root: postcss.Root): AstNode[] {
  let inputMap = new DefaultMap<postcss.Input, Source>((input) => ({
    file: input.file ?? input.id ?? null,
    code: input.css,
  }))

  function toSource(node: postcss.ChildNode): SourceLocation | undefined {
    let source = node.source
    if (!source) return undefined

    let input = source.input
    if (!input) return undefined
    if (source.start === undefined) return undefined
    if (source.end === undefined) return undefined

    return [inputMap.get(input), source.start.offset, source.end.offset]
  }

  function transform(
    node: postcss.ChildNode,
    parent: Extract<AstNode, { nodes: AstNode[] }>['nodes'],
  ) {
    // Declaration
    if (node.type === 'decl') {
      let astNode = decl(node.prop, node.value, node.important)
      astNode.src = toSource(node)
      parent.push(astNode)
    }

    // Rule
    else if (node.type === 'rule') {
      let astNode = styleRule(node.selector)
      astNode.src = toSource(node)
      node.each((child) => transform(child, astNode.nodes))
      parent.push(astNode)
    }

    // AtRule
    else if (node.type === 'atrule') {
      let astNode = atRule(`@${node.name}`, node.params, node.nodes ? [] : null)
      astNode.src = toSource(node)
      node.each((child) => transform(child, astNode.nodes!))
      parent.push(astNode)
    }

    // Comment
    else if (node.type === 'comment') {
      if (node.text.charCodeAt(0) !== EXCLAMATION_MARK) return
      let astNode = comment(node.text)
      astNode.src = toSource(node)
      parent.push(astNode)
    }

    // Unknown
    else {
      node satisfies never
    }
  }

  let ast: AstNode[] = []
  root.each((node) => transform(node, ast))

  return ast
}
