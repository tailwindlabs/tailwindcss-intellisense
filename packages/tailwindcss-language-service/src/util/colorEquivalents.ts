import type { Plugin } from 'postcss'
import parseValue from 'postcss-value-parser'
import postcss from 'postcss'
import { formatColor, getColorFromValue } from './color'
import type { Comment } from './comments'
import { applyComments } from './comments'

export function addColorEquivalentsToCss(css: string): string {
  let comments: Comment[] = []

  try {
    postcss([postcssPlugin({ comments })]).process(css, { from: undefined }).css
  } catch {
    return css
  }

  return applyComments(css, comments)
}

function postcssPlugin({ comments }: { comments: Comment[] }): Plugin {
  return {
    postcssPlugin: 'plugin',
    Declaration(decl) {
      if (!decl.value.includes('rgb') && !decl.value.includes('hsl')) {
        return
      }

      parseValue(decl.value).walk((node) => {
        if (node.type !== 'function') {
          return true
        }

        if (
          node.value !== 'rgb' &&
          node.value !== 'rgba' &&
          node.value !== 'hsl' &&
          node.value !== 'hsla'
        ) {
          return false
        }

        const values = node.nodes.filter((n) => n.type === 'word').map((n) => n.value)
        if (values.length < 3) {
          return false
        }

        const color = getColorFromValue(`rgb(${values.join(', ')})`)
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
postcssPlugin.postcss = true
