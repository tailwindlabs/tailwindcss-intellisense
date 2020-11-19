const dlv = require('dlv')
import { State } from './state'
import removeMeta from './removeMeta'
import { TinyColor } from '@ctrl/tinycolor'
import { ensureArray, dedupe, flatten } from './array'

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

function isKeyword(value: string): boolean {
  return ['transparent', 'currentcolor'].includes(value.toLowerCase())
}

export function getColor(
  state: State,
  keys: string[]
): TinyColor | string | null {
  const item = dlv(state.classNames.classNames, [...keys, '__info'])
  if (!item.__rule) return null
  const props = Object.keys(removeMeta(item))
  if (props.length === 0) return null
  const nonCustomProps = props.filter((prop) => !prop.startsWith('--'))

  const areAllCustom = nonCustomProps.length === 0

  if (
    !areAllCustom &&
    nonCustomProps.some((prop) => !COLOR_PROPS.includes(prop))
  ) {
    // they should all be color-based props
    return null
  }

  const propsToCheck = areAllCustom ? props : nonCustomProps

  const colors = flatten(
    propsToCheck.map((prop) => ensureArray(item[prop]).map(createColor))
  )

  // check that all of the values are valid colors
  if (colors.some((color) => typeof color !== 'string' && !color.isValid)) {
    return null
  }

  // check that all of the values are the same color, ignoring alpha
  const colorStrings = dedupe(
    colors.map((color) =>
      typeof color === 'string' ? color : `${color.r}-${color.g}-${color.b}`
    )
  )
  if (colorStrings.length !== 1) {
    return null
  }

  if (isKeyword(colorStrings[0])) {
    return colorStrings[0]
  }

  const nonKeywordColors = colors.filter(
    (color): color is TinyColor => typeof color !== 'string'
  )

  const alphas = dedupe(nonKeywordColors.map((color) => color.a))

  if (alphas.length === 1) {
    return nonKeywordColors[0]
  }

  if (alphas.length === 2 && alphas.includes(0)) {
    return nonKeywordColors.find((color) => color.a !== 0)
  }

  return null
}

export function getColorFromValue(value: unknown): string {
  if (typeof value !== 'string') return null
  if (value === 'transparent') {
    return 'rgba(0, 0, 0, 0.01)'
  }
  const color = new TinyColor(value)
  if (color.isValid) {
    return color.toRgbString()
  }
  return null
}

function createColor(str: string): TinyColor | string {
  if (isKeyword(str)) {
    return str
  }

  // matches: rgba(<r>, <g>, <b>, var(--bg-opacity))
  // TODO: support other formats? e.g. hsla, css level 4
  const match = str.match(
    /^\s*rgba\(\s*(?<r>[0-9]{1,3})\s*,\s*(?<g>[0-9]{1,3})\s*,\s*(?<b>[0-9]{1,3})\s*,\s*var/
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
