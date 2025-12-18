import * as postcss from 'postcss'
import type { AstNode } from './ast'
import type { Source, SourceLocation } from './source'
import { DefaultMap } from '../util/default-map'
import { createLineTable, LineTable } from '../util/line-table'

export function toPostCSSAst(ast: AstNode[], source?: postcss.Source): postcss.Root {
  let inputMap = new DefaultMap<Source, postcss.Input>((src) => {
    return new postcss.Input(src.code, {
      map: source?.input.map,
      from: src.file ?? undefined,
    })
  })

  let lineTables = new DefaultMap<Source, LineTable>((src) => createLineTable(src.code))

  let root = postcss.root()

  // Trick PostCSS into thinking the indent is 2 spaces, so it uses that
  // as the default instead of 4.
  root.raws.indent = '  '

  root.source = source

  function toSource(loc: SourceLocation | undefined): postcss.Source | undefined {
    // Use the fallback if this node has no location info in the AST
    if (!loc) return undefined
    if (!loc[0]) return undefined

    let table = lineTables.get(loc[0])
    let start = table.find(loc[1])
    let end = table.find(loc[2])

    return {
      input: inputMap.get(loc[0]),
      start: {
        line: start.line,
        column: start.column + 1,
        offset: loc[1],
      },
      end: {
        line: end.line,
        column: end.column + 1,
        offset: loc[2],
      },
    }
  }

  function updateSource(astNode: postcss.ChildNode, loc: SourceLocation | undefined) {
    let source = toSource(loc)

    // The `source` property on PostCSS nodes must be defined if present because
    // `toJSON()` reads each property and tries to read from source.input if it
    // sees a `source` property. This means for a missing or otherwise absent
    // source it must be *missing* from the object rather than just `undefined`
    if (source) {
      astNode.source = source
    } else {
      delete astNode.source
    }
  }

  function transform(node: AstNode, parent: postcss.Container) {
    // Declaration
    if (node.kind === 'declaration') {
      let astNode = postcss.decl({
        prop: node.property,
        value: node.value ?? '',
        important: node.important,
      })
      updateSource(astNode, node.src)
      parent.append(astNode)
    }

    // Rule
    else if (node.kind === 'rule') {
      let astNode = postcss.rule({ selector: node.selector })
      updateSource(astNode, node.src)
      astNode.raws.semicolon = true
      parent.append(astNode)
      for (let child of node.nodes) {
        transform(child, astNode)
      }
    }

    // AtRule
    else if (node.kind === 'at-rule') {
      let astNode = postcss.atRule({
        name: node.name.slice(1),
        params: node.params,
        ...(node.nodes ? { nodes: [] } : {}),
      })
      updateSource(astNode, node.src)
      astNode.raws.semicolon = true
      parent.append(astNode)
      for (let child of node.nodes ?? []) {
        transform(child, astNode)
      }
    }

    // Comment
    else if (node.kind === 'comment') {
      let astNode = postcss.comment({ text: node.value })
      // Spaces are encoded in our node.value already, no need to add additional
      // spaces.
      astNode.raws.left = ''
      astNode.raws.right = ''
      updateSource(astNode, node.src)
      parent.append(astNode)
    }

    // AtRoot & Context should not happen
    else if (node.kind === 'at-root' || node.kind === 'context') {
    }

    // Unknown
    else {
      node satisfies never
    }
  }

  for (let node of ast) {
    transform(node, root)
  }

  return root
}
