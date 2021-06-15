const dlv = require('dlv')
import { State } from './state'
import removeMeta from './removeMeta'
import { TinyColor, names as colorNames } from '@ctrl/tinycolor'
import { ensureArray, dedupe, flatten } from './array'
import type { Color } from 'vscode-languageserver'
import { getClassNameParts } from './getClassNameAtPosition'
import * as jit from './jit'

const COLOR_PROPS = [
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

type KeywordColor = 'transparent' | 'currentColor'

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
  `(#(?:[0-9a-f]{2}){2,4}|(#[0-9a-f]{3})|(rgb|hsl)a?\\((-?[\\d.]+%?[,\\s]+){2,3}\\s*([\\d.]+%?|var\\([^)]+\\))?\\)|transparent|currentColor|${Object.keys(
    colorNames
  ).join('|')})`,
  'gi'
)

function getColorsInString(str: string): (TinyColor | KeywordColor)[] {
  if (/(?:box|drop)-shadow/.test(str)) return []

  return (
    str
      .match(colorRegex)
      ?.map((color) => color.replace(/var\([^)]+\)/, '1'))
      .map((color) => getKeywordColor(color) ?? new TinyColor(color))
      .filter((color) => (color instanceof TinyColor ? color.isValid : true)) ?? []
  )
}

function getColorFromDecls(
  decls: Record<string, string | string[]>
): TinyColor | KeywordColor | null {
  let props = Object.keys(decls).filter((prop) => {
    // ignore content: "";
    if (prop === 'content' && (decls[prop] === '""' || decls[prop] === "''")) {
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
    colors.map((color) => (color instanceof TinyColor ? `${color.r}-${color.g}-${color.b}` : color))
  )
  if (colorStrings.length !== 1) {
    return null
  }

  let keyword = getKeywordColor(colorStrings[0])
  if (keyword) {
    return keyword
  }

  const nonKeywordColors = colors.filter((color): color is TinyColor => typeof color !== 'string')

  const alphas = dedupe(nonKeywordColors.map((color) => color.a))

  if (alphas.length === 1) {
    return nonKeywordColors[0]
  }

  if (alphas.length === 2 && alphas.includes(0)) {
    return nonKeywordColors.find((color) => color.a !== 0)
  }

  return null
}

export function getColor(state: State, className: string): TinyColor | KeywordColor | null {
  if (state.jit) {
    const item = dlv(state.classNames.classNames, [className, '__info'])
    if (item && item.__rule) {
      return getColorFromDecls(removeMeta(item))
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

export function getColorFromValue(value: unknown): TinyColor | KeywordColor | null {
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
    !Object.keys(colorNames).includes(trimmedValue)
  ) {
    return null
  }
  const color = new TinyColor(trimmedValue)
  if (color.isValid) {
    return color
    // return { red: color.r / 255, green: color.g / 255, blue: color.b / 255, alpha: color.a }
  }
  return null
}

function createColor(str: string): TinyColor | KeywordColor {
  let keyword = getKeywordColor(str)
  if (keyword) {
    return keyword
  }

  // matches: rgba(<r>, <g>, <b>, var(--bg-opacity))
  // TODO: support other formats? e.g. hsla, css level 4
  const match = str.match(
    /^\s*rgba\(\s*(?<r>[0-9.]+)\s*,\s*(?<g>[0-9.]+)\s*,\s*(?<b>[0-9.]+)\s*,\s*var/
  )

  if (match) {
    return new TinyColor({
      r: match.groups.r,
      g: match.groups.g,
      b: match.groups.b,
    })
  }

  return new TinyColor(str)
}

export function tinyColorToVscodeColor(color: TinyColor): Color {
  return { red: color.r / 255, green: color.g / 255, blue: color.b / 255, alpha: color.a }
}
