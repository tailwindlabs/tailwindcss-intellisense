import type { Plugin, PluginCreator } from 'postcss'
import parseValue from 'postcss-value-parser'
import { inGamut } from 'culori'
import { formatColor, getColorFromValue } from './color'
import type { Comment } from './comments'

let allowedFunctions = ['rgb', 'rgba', 'hsl', 'hsla', 'lch', 'lab', 'oklch', 'oklab']

export function getEquivalentColor(value: string): string {
  const color = getColorFromValue(value)

  if (!color) return value
  if (typeof color === 'string') return value
  if (!inGamut('rgb')(color)) return value

  return formatColor(color)
}

export const equivalentColorValues: PluginCreator<any> = Object.assign(
  ({ comments }: { comments: Comment[] }): Plugin => {
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

          if (node.value === 'var') {
            return true
          }

          if (!allowedFunctions.includes(node.value)) {
            return false
          }

          const values = node.nodes.filter((n) => n.type === 'word').map((n) => n.value)
          if (values.length < 3) {
            return false
          }

          let color = `${node.value}(${values.join(' ')})`

          let equivalent = getEquivalentColor(color)

          if (equivalent === color) {
            return false
          }

          comments.push({
            index:
              decl.source.start.offset +
              `${decl.prop}${decl.raws.between}`.length +
              node.sourceEndIndex,
            value: equivalent,
          })

          return false
        })
      },
    }
  },
  {
    postcss: true as const,
  },
)
