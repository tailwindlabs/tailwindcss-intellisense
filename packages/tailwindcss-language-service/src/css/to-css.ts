import { AstNode } from './ast'
import { Source } from './source'

export function toCss(ast: AstNode[], track?: boolean): string {
  let pos = 0

  let source: Source = {
    file: null,
    code: '',
  }

  function stringify(node: AstNode, depth = 0): string {
    let css = ''
    let indent = '  '.repeat(depth)

    // Declaration
    if (node.kind === 'declaration') {
      css += `${indent}${node.property}: ${node.value}${node.important ? ' !important' : ''};\n`

      if (track) {
        // indent
        pos += indent.length

        // node.property
        let start = pos
        pos += node.property.length

        // `: `
        pos += 2

        // node.value
        pos += node.value?.length ?? 0

        // !important
        if (node.important) {
          pos += 11
        }

        let end = pos

        // `;\n`
        pos += 2

        node.dst = [source, start, end]
      }
    }

    // Rule
    else if (node.kind === 'rule') {
      css += `${indent}${node.selector} {\n`

      if (track) {
        // indent
        pos += indent.length

        // node.selector
        let start = pos
        pos += node.selector.length

        // ` `
        pos += 1

        let end = pos
        node.dst = [source, start, end]

        // `{\n`
        pos += 2
      }

      for (let child of node.nodes) {
        css += stringify(child, depth + 1)
      }

      css += `${indent}}\n`

      if (track) {
        // indent
        pos += indent.length

        // `}\n`
        pos += 2
      }
    }

    // AtRule
    else if (node.kind === 'at-rule') {
      // Print at-rules without nodes with a `;` instead of an empty block.
      //
      // E.g.:
      //
      // ```css
      // @layer base, components, utilities;
      // ```
      if (!node.nodes) {
        let css = `${indent}${node.name} ${node.params};\n`

        if (track) {
          // indent
          pos += indent.length

          // node.name
          let start = pos
          pos += node.name.length

          // ` `
          pos += 1

          // node.params
          pos += node.params.length
          let end = pos

          // `;\n`
          pos += 2

          node.dst = [source, start, end]
        }

        return css
      }

      css += `${indent}${node.name}${node.params ? ` ${node.params} ` : ' '}{\n`

      if (track) {
        // indent
        pos += indent.length

        // node.name
        let start = pos
        pos += node.name.length

        if (node.params) {
          // ` `
          pos += 1

          // node.params
          pos += node.params.length
        }

        // ` `
        pos += 1

        let end = pos
        node.dst = [source, start, end]

        // `{\n`
        pos += 2
      }

      for (let child of node.nodes) {
        css += stringify(child, depth + 1)
      }

      css += `${indent}}\n`

      if (track) {
        // indent
        pos += indent.length

        // `}\n`
        pos += 2
      }
    }

    // Comment
    else if (node.kind === 'comment') {
      css += `${indent}/*${node.value}*/\n`

      if (track) {
        // indent
        pos += indent.length

        // The comment itself. We do this instead of just the inside because
        // it seems more useful to have the entire comment span tracked.
        let start = pos
        pos += 2 + node.value.length + 2
        let end = pos

        node.dst = [source, start, end]

        // `\n`
        pos += 1
      }
    }

    // These should've been handled already by `optimizeAst` which
    // means we can safely ignore them here. We return an empty string
    // immediately to signal that something went wrong.
    else if (node.kind === 'context' || node.kind === 'at-root') {
      return ''
    }

    // Unknown
    else {
      node satisfies never
    }

    return css
  }

  let css = ''

  for (let node of ast) {
    css += stringify(node, 0)
  }

  source.code = css

  return css
}
