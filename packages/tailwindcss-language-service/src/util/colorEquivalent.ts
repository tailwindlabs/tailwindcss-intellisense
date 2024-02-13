import type { Plugin } from 'postcss'
import parseValue from 'postcss-value-parser'
import postcss from 'postcss'
import { formatColor, getColorFromValue } from './color'

type Comment = { index: number; value: string }

export function addColorEquivalentsToCss(css: string): string {
  if (!css.includes('rgb')) {
    return css
  }

  let comments: Comment[] = []

  try {
    postcss([postcssPlugin({ comments })]).process(css, { from: undefined }).css
  } catch {
    return css
  }

  return applyComments(css, comments)
}

function applyComments(str: string, comments: Comment[]): string {
  let offset = 0

  for (let comment of comments) {
    let index = comment.index + offset
    let commentStr = `/* ${comment.value} */`
    str = str.slice(0, index) + commentStr + str.slice(index)
    offset += commentStr.length
  }

  return str
}

function postcssPlugin({
  comments,
}: {
  comments: Comment[]
}): Plugin {
  return {
    postcssPlugin: 'plugin',
    Declaration(decl) {
      if (!decl.value.includes('rgb')) {
        return
      }

      parseValue(decl.value).walk((node) => {
        if (node.type !== 'function') {
          return true
        }

        if (node.value !== 'rgb') {
          return false
        }

        const values = node.nodes.filter((n) => n.type === 'word').map((n) => n.value)
        if (values.length < 3) {
          return false
        }

        const color = getColorFromValue(`rgb(${values.join(', ')})`);
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
