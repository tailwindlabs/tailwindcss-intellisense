export type Rule = {
  kind: 'rule'
  selector: string
  nodes: AstNode[]
}

export type Declaration = {
  kind: 'declaration'
  property: string
  value: string
  important: boolean
}

export type Comment = {
  kind: 'comment'
  value: string
}

export type AstNode = Rule | Declaration | Comment

export function visit(
  nodes: AstNode[],
  cb: (node: AstNode, path: AstNode[]) => void,
  path: AstNode[] = [],
): void {
  for (let child of nodes) {
    path = [...path, child]
    cb(child, path)
    if (child.kind === 'rule') {
      visit(child.nodes, cb, path)
    }
  }
}
