import removeMeta from './removeMeta'
const dlv = require('dlv')
import escapeClassName from 'css.escape'
import { ensureArray } from './array'

export function stringifyConfigValue(x: any): string {
  if (typeof x === 'string') return x
  if (typeof x === 'number') return x.toString()
  if (Array.isArray(x)) {
    return x
      .filter((y) => typeof y === 'string')
      .filter(Boolean)
      .join(', ')
  }
  return null
}

export function stringifyCss(className: string, obj: any): string {
  if (obj.__rule !== true && !Array.isArray(obj)) return null

  if (Array.isArray(obj)) {
    const rules = obj.map((x) => stringifyCss(className, x)).filter(Boolean)
    if (rules.length === 0) return null
    return rules.join('\n\n')
  }

  let css = ``

  const context = dlv(obj, '__context', [])
  const props = Object.keys(removeMeta(obj))
  if (props.length === 0) return null

  for (let i = 0; i < context.length; i++) {
    css += `${'\t'.repeat(i)}${context[i]} {\n`
  }

  const indentStr = '\t'.repeat(context.length)
  const decls = props.reduce((acc, curr, i) => {
    const propStr = ensureArray(obj[curr])
      .map((val) => `${indentStr + '\t'}${curr}: ${val};`)
      .join('\n')
    return `${acc}${i === 0 ? '' : '\n'}${propStr}`
  }, '')
  css += `${indentStr}${augmentClassName(
    className,
    obj
  )} {\n${decls}\n${indentStr}}`

  for (let i = context.length - 1; i >= 0; i--) {
    css += `${'\t'.repeat(i)}\n}`
  }

  return css
}

function augmentClassName(className: string, obj: any): string {
  const pseudo = obj.__pseudo.join('')
  const scope = obj.__scope ? `${obj.__scope} ` : ''
  return `${scope}.${escapeClassName(className)}${pseudo}`
}
