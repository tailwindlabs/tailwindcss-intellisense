type AstLocation = { start: number; end: number }

type AstNode =
  // var(--name, …)
  | { kind: 'fn-var'; name: string; fallback: AstNode[] }

  // theme(--name / 50%, …)
  | { kind: 'fn-theme'; name: string; alpha: AstNode[]; nodes: AstNode[] }

  // everything else
  | { kind: 'text'; value: string }

export function parse(str: string): AstNode[] {
  //
}

interface Visitor {
  enter(node: AstNode): void
  exit(node: AstNode): void
}
