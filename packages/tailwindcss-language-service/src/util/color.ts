import dlv from 'dlv'
import type { State } from './state'
import removeMeta from './removeMeta'
import { ensureArray, dedupe } from './array'
import type { Color } from 'vscode-languageserver'
import { getClassNameParts } from './getClassNameAtPosition'
import * as jit from './jit'
import * as culori from 'culori'
import namedColors from 'color-name'
import postcss from 'postcss'
import { replaceCssVarsWithFallbacks } from './rewriting'

const COLOR_PROPS = [
  'accent-color',
  'caret-color',
  'color',
  'column-rule-color',
  'background-color',
  'border-color',
  'border-top-color',
  'border-right-color',
  'border-bottom-color',
  'border-left-color',
  'border-inline-color',
  'border-inline-start-color',
  'border-inline-end-color',
  'border-block-color',
  'border-block-start-color',
  'border-block-end-color',
  'fill',
  'outline-color',
  'stop-color',
  'stroke',
  'text-decoration-color',
]

export type KeywordColor = 'transparent' | 'currentColor'

function getKeywordColor(value: unknown): KeywordColor | null {
  if (typeof value !== 'string') return null
  let lowercased = value.toLowerCase()
  if (lowercased === 'transparent') {
    return 'transparent'
  }
  if (lowercased === 'currentcolor') {
    return 'currentColor'
  }
  return null
}

// https://github.com/khalilgharbaoui/coloregex
const colorRegex = new RegExp(
  `(?:^|\\s|\\(|,)(#(?:[0-9a-f]{2}){2,4}|(#[0-9a-f]{3})|(rgba?|hsla?|(?:ok)?(?:lab|lch))\\(\\s*(-?[\\d.]+(%|deg|rad|grad|turn)?(\\s*[,/]\\s*|\\s+)+){2,3}\\s*([\\d.]+%?|var\\([^)]+\\))?\\)|transparent|currentColor|${Object.keys(
    namedColors,
  ).join('|')})(?:$|\\s|\\)|,)`,
  'gi',
)

function getColorsInString(state: State, str: string): (culori.Color | KeywordColor)[] {
  if (/(?:box|drop)-shadow/.test(str) && !/--tw-drop-shadow/.test(str)) return []

  function toColor(match: RegExpMatchArray) {
    let color = match[1].replace(/var\([^)]+\)/, '1')
    return getKeywordColor(color) ?? tryParseColor(color)
  }

  str = replaceCssVarsWithFallbacks(state, str)
  str = removeColorMixWherePossible(str)
  str = resolveLightDark(str)

  let possibleColors = str.matchAll(colorRegex)

  return Array.from(possibleColors, toColor).filter(Boolean)
}

function getColorFromDecls(
  state: State,
  decls: Record<string, string | string[]>,
): culori.Color | KeywordColor | null {
  let props = Object.keys(decls).filter((prop) => {
    // ignore content: "";
    if (
      prop === 'content' &&
      (decls[prop] === '""' || decls[prop] === "''" || decls[prop] === 'var(--tw-content)')
    ) {
      return false
    }

    // ignore mask-image & mask-composite
    if (prop === 'mask-image' || prop === 'mask-composite') {
      return false
    }

    // ignore `--tw-drop-shadow`
    if (prop === '--tw-drop-shadow') {
      return false
    }

    return true
  })

  if (props.length === 0) return null

  const nonCustomProps = props.filter((prop) => !prop.startsWith('--'))

  const areAllCustom = nonCustomProps.length === 0

  if (!areAllCustom && nonCustomProps.some((prop) => !COLOR_PROPS.includes(prop))) {
    // they should all be color-based props
    return null
  }

  const propsToCheck = areAllCustom ? props : nonCustomProps

  const colors = propsToCheck.flatMap((prop) =>
    ensureArray(decls[prop]).flatMap((str) => getColorsInString(state, str)),
  )

  // check that all of the values are valid colors
  // if (colors.some((color) => color instanceof TinyColor && !color.isValid)) {
  //   return null
  // }

  // check that all of the values are the same color, ignoring alpha
  const colorStrings = dedupe(
    colors.map((color) =>
      typeof color === 'string' ? color : culori.formatRgb({ ...color, alpha: undefined }),
    ),
  )
  if (colorStrings.length !== 1) {
    return null
  }

  let keyword = getKeywordColor(colorStrings[0])
  if (keyword) {
    return keyword
  }

  const nonKeywordColors = colors.filter(
    (color): color is culori.Color => typeof color !== 'string',
  )

  const alphas = dedupe(nonKeywordColors.map((color) => color.alpha ?? 1))

  if (alphas.length === 1) {
    return nonKeywordColors[0]
  }

  if (alphas.length === 2 && alphas.includes(0)) {
    return nonKeywordColors.find((color) => (color.alpha ?? 1) !== 0)
  }

  return null
}

function getColorFromRoot(state: State, css: postcss.Root): culori.Color | KeywordColor | null {
  // Remove any `@property` rules
  css = css.clone()
  css.walkAtRules((rule) => {
    // Ignore declarations inside `@property` rules
    if (rule.name === 'property') {
      rule.remove()
    }

    // Ignore declarations @supports (-moz-orient: inline)
    // this is a hack used for `@property` fallbacks in Firefox
    if (rule.name === 'supports' && rule.params === '(-moz-orient: inline)') {
      rule.remove()
    }
  })

  let decls: Record<string, string[]> = {}

  let rule = postcss.rule({
    selector: '.x',
    nodes: [],
  })

  css.walkDecls((decl) => {
    rule.append(decl.clone())
  })

  css.walkDecls((decl) => {
    decls[decl.prop] ??= []
    decls[decl.prop].push(decl.value)
  })

  return getColorFromDecls(state, decls)
}

let isNegative = /^-/
let isNumericUtility =
  /^-?((min-|max-)?[wh]|z|start|order|opacity|rounded|row|col|size|basis|end|duration|ease|font|top|left|bottom|right|inset|leading|cursor|(space|scale|skew|rotate)-[xyz]|gap(-[xy])?|(scroll-)?[pm][trblxyse]?)-/
let isMaskUtility = /^-?mask-/

function isLikelyColorless(className: string) {
  if (isNegative.test(className)) return true
  // TODO: This is **not** correct but is intentional because there are 5k mask utilities and a LOT of them are colors
  // This causes a massive slowdown when building the design system
  if (isMaskUtility.test(className)) return true
  if (isNumericUtility.test(className)) return true
  return false
}

export function getColor(state: State, className: string): culori.Color | KeywordColor | null {
  if (state.v4) {
    // FIXME: This is a performance optimization and not strictly correct
    if (isLikelyColorless(className)) return null

    let css = state.designSystem.compile([className])[0]

    let color = getColorFromRoot(state, css)

    return color
  }

  if (state.jit) {
    if (state.classNames) {
      const item = dlv(state.classNames.classNames, [className, '__info'])
      if (item && item.__rule) {
        return getColorFromDecls(state, removeMeta(item))
      }
    }

    let result!: ReturnType<typeof jit.generateRules>
    try {
      result = jit.generateRules(state, [className])
    } catch (err) {
      console.error(`Error generating rules for className: ${className}`)
      console.error(err)
      return null
    }

    let { root, rules } = result
    if (rules.length === 0) return null

    let decls: Record<string, string | string[]> = {}
    root.walkDecls((decl) => {
      let value = decls[decl.prop]
      if (value) {
        if (Array.isArray(value)) {
          value.push(decl.value)
        } else {
          decls[decl.prop] = [value, decl.value]
        }
      } else {
        decls[decl.prop] = decl.value
      }
    })
    return getColorFromDecls(state, decls)
  }

  let parts = getClassNameParts(state, className)
  if (!parts) return null

  const item = dlv(state.classNames.classNames, [...parts, '__info'])
  if (!item.__rule) return null

  return getColorFromDecls(state, removeMeta(item))
}

export function getColorFromValue(value: unknown): culori.Color | KeywordColor | null {
  if (typeof value !== 'string') return null
  const trimmedValue = value.trim()
  if (trimmedValue.toLowerCase() === 'transparent') {
    return 'transparent'
  }
  if (trimmedValue.toLowerCase() === 'currentcolor') {
    return 'currentColor'
  }
  if (
    !/^\s*(?:rgba?|hsla?|(?:ok)?(?:lab|lch))\s*\([^)]+\)\s*$/.test(trimmedValue) &&
    !/^\s*#[0-9a-f]+\s*$/i.test(trimmedValue) &&
    !Object.keys(namedColors).includes(trimmedValue)
  ) {
    return null
  }

  return tryParseColor(trimmedValue)
}

let toRgb = culori.converter('rgb')

export function culoriColorToVscodeColor(color: culori.Color): Color {
  let rgb = culori.clampRgb(toRgb(color))
  return { red: rgb.r, green: rgb.g, blue: rgb.b, alpha: rgb.alpha ?? 1 }
}

export function formatColor(color: culori.Color): string {
  if (color.alpha === undefined || color.alpha === 1) {
    return culori.formatHex(color)
  }

  return culori.formatHex8(color)
}

const COLOR_MIX_REGEX = /color-mix\(in [^,]+,\s*(.*?)\s*(\d+|\.\d+|\d+\.\d+)%,\s*transparent\)/g

function tryParseColor(color: string) {
  try {
    return culori.parse(color) ?? null
  } catch (err) {
    console.error('Error parsing color', color)
    console.error(err)
    return null
  }
}

function removeColorMixWherePossible(str: string) {
  return str.replace(COLOR_MIX_REGEX, (match, color, percentage) => {
    if (color.startsWith('var(')) return match

    let parsed = tryParseColor(color)
    if (!parsed) return match

    let alpha = Number(percentage) / 100
    if (Number.isNaN(alpha)) return match

    return culori.formatRgb({ ...parsed, alpha })
  })
}

const LIGHT_DARK_REGEX = /light-dark\(\s*(.*?)\s*,\s*.*?\s*\)/g

function resolveLightDark(str: string) {
  return str.replace(LIGHT_DARK_REGEX, (_, lightColor) => lightColor)
}
