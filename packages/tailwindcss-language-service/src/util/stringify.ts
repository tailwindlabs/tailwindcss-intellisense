import removeMeta from './removeMeta'
import dlv from 'dlv'
import escapeClassName from 'css.escape'
import { ensureArray } from './array'
import stringifyObject from 'stringify-object'
import isObject from './isObject'
import { Settings } from './state'
import { addPixelEquivalentsToCss } from './pixelEquivalents'
import { addColorEquivalentsToCss } from './colorEquivalent'

export function stringifyConfigValue(x: any): string {
  if (isObject(x)) return `${Object.keys(x).length} values`
  if (typeof x === 'function') return 'ƒ'
  return stringifyObject(x, {
    inlineCharacterLimit: Infinity,
    singleQuotes: false,
    transform: (obj, prop, originalResult) => {
      if (typeof obj[prop] === 'function') {
        return 'ƒ'
      }
      return originalResult
    },
  })
}

export function stringifyCss(className: string, obj: any, settings: Settings): string {
  if (obj.__rule !== true && !Array.isArray(obj)) return null

  if (Array.isArray(obj)) {
    const rules = obj.map((x) => stringifyCss(className, x, settings)).filter(Boolean)
    if (rules.length === 0) return null
    return rules.join('\n\n')
  }

  let css = ``
  const indent = ' '.repeat(settings.editor.tabSize)

  const context = dlv(obj, '__context', [])
  const props = Object.keys(removeMeta(obj))
  if (props.length === 0) return null

  for (let i = 0; i < context.length; i++) {
    css += `${indent.repeat(i)}${context[i]} {\n`
  }

  const indentStr = indent.repeat(context.length)
  const decls = props.reduce((acc, curr, i) => {
    const propStr = ensureArray(obj[curr])
      .map((val) => `${indentStr + indent}${curr}: ${val};`)
      .join('\n')
    return `${acc}${i === 0 ? '' : '\n'}${propStr}`
  }, '')
  css += `${indentStr}${augmentClassName(className, obj)} {\n${decls}\n${indentStr}}`

  for (let i = context.length - 1; i >= 0; i--) {
    css += `${indent.repeat(i)}\n}`
  }

  if (settings.tailwindCSS.showPixelEquivalents) {
    return addPixelEquivalentsToCss(css, settings.tailwindCSS.rootFontSize)
  }
  if (settings.tailwindCSS.colorFormat !== 'rgb') {
    return addColorEquivalentsToCss(css, settings.tailwindCSS)
  }

  return css
}

function augmentClassName(className: string, obj: any): string {
  const pseudo = obj.__pseudo.join('')
  const scope = obj.__scope ? `${obj.__scope} ` : ''
  return `${scope}.${escapeClassName(className)}${pseudo}`
}
