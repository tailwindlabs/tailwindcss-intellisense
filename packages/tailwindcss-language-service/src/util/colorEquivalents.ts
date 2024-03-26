import type { Plugin } from 'postcss'
import parseValue from 'postcss-value-parser'
import { formatColor, getColorFromValue } from './color'
import type { Comment } from './comments'

let allowedFunctions = ['rgb', 'rgba', 'hsl', 'hsla']

export function equivalentColorValues({ comments }: { comments: Comment[] }): Plugin {
  return {
    postcssPlugin: 'plugin',
    Declaration(decl) {
      if (!allowedFunctions.some((fn) => decl.value.includes(fn))) {
        return
      }

      parseValue(decl.value).walk((node) => {
        if (node.type !== 'function') {
          return true
        }

        if (!allowedFunctions.includes(node.value)) {
          return false
        }

        const values = node.nodes.filter((n) => n.type === 'word').map((n) => n.value)
        if (values.length < 3) {
          return false
        }

        const color = getColorFromValue(`${node.value}(${values.join(' ')})`)
        if (!color || typeof color === 'string') {
          return false
        }

        comments.push({
          index:
            decl.source.start.offset +
            `${decl.prop}${decl.raws.between}`.length +
            node.sourceEndIndex,
          value: formatColor(color),
        })

        return false
      })
    },
  }
}
equivalentColorValues.postcss = true
