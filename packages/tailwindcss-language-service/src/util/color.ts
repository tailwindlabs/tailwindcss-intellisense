import dlv from 'dlv'
import type { State } from './state'
import removeMeta from './removeMeta'
import { ensureArray, dedupe } from './array'
import type { Color } from 'vscode-languageserver'
import { getClassNameParts } from './getClassNameAtPosition'
import * as jit from './jit'
import * as culori from 'culori'
import namedColors from 'color-name'
import { replaceCssVarsWithFallbacks } from './rewriting'
import { AstNode } from '../css'
import { walk, WalkAction } from './walk'

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
export type ParsedColor = KeywordColor | culori.Color

function getKeywordColor(value: unknown): KeywordColor | null {
  if (typeof value !== 'string') return null

  value = value.toLowerCase()

  if (value === 'transparent') return 'transparent'
  if (value === 'currentcolor') return 'currentColor'

  return null
}

function getColorsInString(state: State, str: string): ParsedColor[] {
  if (/(?:box|drop)-shadow/.test(str) && !/--tw-drop-shadow/.test(str)) return []

  str = replaceCssVarsWithFallbacks(state, str)
  str = removeColorMixWherePossible(str)
  str = resolveLightDark(str)

  return parseColors(str)
}

function getColorFromDecls(
  state: State,
  decls: Record<string, string | string[]>,
): ParsedColor | null {
  let props = Object.keys(decls).filter((prop) => {
    // ignore content: "";
    if (prop === 'content') {
      let value = decls[prop]

      if (Array.isArray(value) && value.length === 1) {
        value = value[0]
      }

      if (value === '""' || value === "''" || value === 'var(--tw-content)') {
        return false
      }
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
  if (keyword) return keyword

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

function getColorFromRoot(state: State, css: AstNode[]): ParsedColor | null {
  let decls: Record<string, string[]> = {}

  walk(css, (node) => {
    if (node.kind === 'at-rule') {
      // Skip over any `@property` rules
      if (node.name === '@property') {
        return WalkAction.Skip
      }

      // Ignore @supports (-moz-orient: inline)
      // This is a hack used for `@property` fallbacks in Firefox
      if (node.name === '@supports' && node.params === '(-moz-orient: inline)') {
        return WalkAction.Skip
      }

      if (
        node.name === '@supports' &&
        node.params === '(background-image: linear-gradient(in lab, red, red))'
      ) {
        return WalkAction.Skip
      }

      return WalkAction.Continue
    }

    if (node.kind === 'declaration' && node.value !== undefined) {
      decls[node.property] ??= []
      decls[node.property].push(node.value)
    }

    return WalkAction.Continue
  })

  return getColorFromDecls(state, decls)
}

let isNegative = /^-/
let isNumericUtility =
  /^-?((min-|max-)?[wh]|z|start|indent|flex|columns|order|rounded|row|col|size|basis|end|delay|duration|ease|font|top|left|bottom|right|leading|cursor|(backdrop-)?(opacity|brightness|sepia|saturate|hue-rotate|grayscale|contrast|blur)|(space|scale|skew|rotate|translate|border-spacing|gap)(-[xyz])?|(scroll-)?[pm][trblxyse]?)-/
let isMaskUtility = /^-?mask-/

function isLikelyColorless(className: string) {
  if (isNegative.test(className)) return true
  if (isNumericUtility.test(className)) return true

  // TODO: This is **not** correct but is intentional because there are 5k mask utilities and a LOT of them are colors
  // This causes a massive slowdown when building the design system
  if (isMaskUtility.test(className)) return true

  return false
}

export function getColor(state: State, className: string): ParsedColor | null {
  if (state.v4) {
    // FIXME: This is a performance optimization and not strictly correct
    if (isLikelyColorless(className)) return null

    let css = state.designSystem.compile([className])[0]
    let color = getColorFromRoot(state, css)

    let prefix = state.designSystem.theme.prefix ?? ''

    // TODO: Either all consumers of this API should assume there's no prefix
    // or pass in correctly prefixed classes
    if (prefix && !color && !className.startsWith(prefix + ':')) {
      className = `${prefix}:${className}`
      css = state.designSystem.compile([className])[0]
      color = getColorFromRoot(state, css)
    }

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

export function getColorFromValue(value: unknown): ParsedColor | null {
  if (typeof value !== 'string') return null

  let trimmedValue = value.trim()
  let keyword = getKeywordColor(trimmedValue)
  if (keyword) return keyword

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

const COLOR_FNS = new Set([
  //
  'rgb',
  'rgba',
  'hwb',
  'hsl',
  'hsla',
  'lab',
  'lch',
  'oklab',
  'oklch',
  'color',
])

const COLOR_NAMES = new Set([
  ...Object.keys(namedColors).map((c) => c.toLowerCase()),
  'transparent',
  'currentcolor',
])

const CSS_VARS = /var\([^)]+\)/
const COLOR_FN_ARGS =
  /^\s*(?:(?:-?[\d.]+(?:%|deg|g?rad|turn)?|var\([^)]+\))(?:\s*[,/]\s*|\s+)){2,3}(?:-?[\d.]+(?:%|deg|g?rad|turn)?|var\([^)]+\))\s*$/i

const POUND = 0x23
const ZERO = 0x30
const NINE = 0x39
const DOUBLE_QUOTE = 0x22
const SINGLE_QUOTE = 0x27
const BACKSLASH = 0x5c
const LOWER_A = 0x61
const LOWER_F = 0x66
const LOWER_Z = 0x7a
const L_PAREN = 0x28
const R_PAREN = 0x29
const SPACE = 0x20
const COMMA = 0x2c
const DASH = 0x2d
const LINE_BREAK = 0x0a
const CARRIAGE_RETURN = 0xd
const TAB = 0x09

type Span = [start: number, end: number]

function maybeFindColors(input: string): Span[] {
  let colors: Span[] = []
  let len = input.length

  for (let i = 0; i < len; ++i) {
    let char = input.charCodeAt(i)
    let inner = char

    if (char >= LOWER_A && char <= LOWER_Z) {
      // Read until we don't have a named color character
      let start = i
      let end = i

      for (let j = start + 1; j < len; j++) {
        inner = input.charCodeAt(j)

        if (inner >= ZERO && inner <= NINE) {
          end = j // 0-9
        } else if (inner >= LOWER_A && inner <= LOWER_Z) {
          end = j // a-z
        } else if (inner === DASH) {
          end = j // -
        } else if (inner === L_PAREN) {
          // Start of a function
          break
        } else if (
          inner === COMMA ||
          inner === SPACE ||
          inner === LINE_BREAK ||
          inner === TAB ||
          inner === CARRIAGE_RETURN ||
          inner === R_PAREN
        ) {
          // (?=$|[\\s),])
          break
        } else {
          end = i
          break
        }
      }

      let name = input.slice(start, end + 1)

      if (COLOR_NAMES.has(name)) {
        i = end
        colors.push([start, end + 1])
        continue
      }

      if (inner === L_PAREN && COLOR_FNS.has(name)) {
        // Scan until the next balanced R_PAREN
        let depth = 1
        let argStart = end + 2

        for (let j = argStart; j < len; ++j) {
          inner = input.charCodeAt(j)

          // The next character is escaped, so we skip it.
          if (inner === BACKSLASH) {
            j += 1
          }

          // Strings should be handled as-is until the end of the string. No need to
          // worry about balancing parens, brackets, or curlies inside a string.
          else if (inner === SINGLE_QUOTE || inner === DOUBLE_QUOTE) {
            // Ensure we don't go out of bounds.
            while (++j < len) {
              let nextChar = input.charCodeAt(j)

              // The next character is escaped, so we skip it.
              if (nextChar === BACKSLASH) {
                j += 1
                continue
              }

              if (nextChar === char) {
                break
              }
            }
          }

          // Track opening parens
          else if (inner === L_PAREN) {
            depth++
          }

          // Track closing parens
          else if (inner === R_PAREN) {
            depth--
          }

          if (depth > 0) continue

          let args = input.slice(argStart, j)

          if (!COLOR_FN_ARGS.test(args)) continue
          colors.push([start, j + 1])
          i = j + 1

          break
        }

        continue
      }

      i = end
    }

    //
    else if (char === POUND) {
      // Read until we don't have a named color character
      let start = i
      let end = i

      // i + 1     = first hex digit
      // i + 1 + 8 = one past the last hex digit
      let last = Math.min(start + 1 + 8, len)

      for (let j = start + 1; j < last; j++) {
        let inner = input.charCodeAt(j)

        if (inner >= ZERO && inner <= NINE) {
          end = j // 0-9
        } else if (inner >= LOWER_A && inner <= LOWER_F) {
          end = j // a-f
        } else if (
          inner === COMMA ||
          inner === SPACE ||
          inner === TAB ||
          inner === LINE_BREAK ||
          inner === CARRIAGE_RETURN ||
          inner === R_PAREN
        ) {
          // (?=$|[\\s),])
          break
        } else {
          end = start
          break
        }
      }

      let hexLen = end - start
      i = end

      if (hexLen === 3 || hexLen === 4 || hexLen === 6 || hexLen === 8) {
        colors.push([start, end + 1])
        continue
      }
    }
  }

  return colors
}

export function findColors(input: string): string[] {
  return maybeFindColors(input.toLowerCase()).map(([start, end]) => input.slice(start, end))
}

export function parseColors(input: string): ParsedColor[] {
  let colors: ParsedColor[] = []

  for (let str of findColors(input)) {
    str = str.replace(CSS_VARS, '1')

    let keyword = getKeywordColor(str)
    if (keyword) {
      colors.push(keyword)
      continue
    }

    let color = tryParseColor(str)
    if (color) {
      colors.push(color)
      continue
    }
  }

  return colors
}
