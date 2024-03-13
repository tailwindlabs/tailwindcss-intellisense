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
  `(?:^|\\s|\\(|,)(#(?:[0-9a-f]{2}){2,4}|(#[0-9a-f]{3})|(rgb|hsl)a?\\(\\s*(-?[\\d.]+%?(\\s*[,/]\\s*|\\s+)+){2,3}\\s*([\\d.]+%?|var\\([^)]+\\))?\\)|transparent|currentColor|${Object.keys(
    namedColors,
  ).join('|')})(?:$|\\s|\\)|,)`,
  'gi',
)

function replaceColorVarsWithTheirDefaults(str: string): string {
  // rgb(var(--primary, 66 66 66))
  // -> rgb(66 66 66)
  return str.replace(/((?:rgb|hsl)a?\(\s*)var\([^,]+,\s*([^)]+)\)/gi, '$1$2')
}

function getColorsInString(str: string): (culori.Color | KeywordColor)[] {
  if (/(?:box|drop)-shadow/.test(str)) return []

  return Array.from(replaceColorVarsWithTheirDefaults(str).matchAll(colorRegex), (match) => {
    let color = match[1].replace(/var\([^)]+\)/, '1')
    return getKeywordColor(color) ?? culori.parse(color)
  }).filter(Boolean)
}

function getColorFromDecls(
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

  const colors = propsToCheck.flatMap((prop) => ensureArray(decls[prop]).flatMap(getColorsInString))

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
  let decls: Record<string, string[]> = {}

  let rule = postcss.rule({
    selector: '.x',
    nodes: [],
  })

  css.walkDecls((decl) => {
    rule.append(decl.clone())
  })

  // Optimize the CSS if possible
  // try {
  //   let str = state.designSystem.toCss(css)
  //   str = state.designSystem.optimizeCss(str)
  //   css = postcss.parse(str)
  // } catch {}

  css.walkDecls((decl) => {
    decls[decl.prop] ??= []
    decls[decl.prop].push(decl.value)
  })

  return getColorFromDecls(decls)
}

export function getColor(state: State, className: string): culori.Color | KeywordColor | null {
  if (state.v4) {
    let css = state.designSystem.compile([className])[0]

    let color = getColorFromRoot(state, css)

    return color
  }

  if (state.jit) {
    if (state.classNames) {
      const item = dlv(state.classNames.classNames, [className, '__info'])
      if (item && item.__rule) {
        return getColorFromDecls(removeMeta(item))
      }
    }

    let { root, rules } = jit.generateRules(state, [className])
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
    return getColorFromDecls(decls)
  }

  let parts = getClassNameParts(state, className)
  if (!parts) return null

  const item = dlv(state.classNames.classNames, [...parts, '__info'])
  if (!item.__rule) return null

  return getColorFromDecls(removeMeta(item))
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
    !/^\s*(?:rgba?|hsla?)\s*\([^)]+\)\s*$/.test(trimmedValue) &&
    !/^\s*#[0-9a-f]+\s*$/i.test(trimmedValue) &&
    !Object.keys(namedColors).includes(trimmedValue)
  ) {
    return null
  }
  const color = culori.parse(trimmedValue)
  return color ?? null
}

let toRgb = culori.converter('rgb')

export function culoriColorToVscodeColor(color: culori.Color): Color {
  let rgb = toRgb(color)
  return { red: rgb.r, green: rgb.g, blue: rgb.b, alpha: rgb.alpha ?? 1 }
}

export function formatColor(color: culori.Color): string {
  if (color.alpha === undefined || color.alpha === 1) {
    return culori.formatHex(color)
  }

  return culori.formatHex8(color)
}
