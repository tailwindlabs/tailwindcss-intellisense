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

export type KeywordColor = 'transparent' | 'currentcolor'

function getKeywordColor(value: unknown): KeywordColor | null {
  if (typeof value !== 'string') return null

  let lowercased = value.toLowerCase()
  if (lowercased === 'transparent' || lowercased === 'currentcolor') {
    return lowercased
  }

  return null
}

let SHADOW_REGEX = /(?:box|drop)-shadow/

// https://github.com/khalilgharbaoui/coloregex
let COLOR_REGEX = new RegExp(
  `(?:^|\\s|\\(|,)(#(?:[0-9a-f]{2}){2,4}|(#[0-9a-f]{3})|(rgb|hsl)a?\\(\\s*(-?[\\d.]+%?(\\s*[,/]\\s*|\\s+)+){2,3}\\s*([\\d.]+%?|var\\([^)]+\\))?\\)|transparent|currentcolor|${Object.keys(
    namedColors,
  ).join('|')})(?:$|\\s|\\)|,)`,
  'gi',
)

export function colorsInRoot(root: postcss.Root): (culori.Color | KeywordColor)[] {
  if (root.nodes.length === 0) return []

  // Collect a list of every property and their values
  let colorDecls: Record<string, string[]> = {}
  let customDecls: Record<string, string[]> = {}
  let otherDecls: Record<string, string[]> = {}

  root.walkDecls((decl) => {
    // Skip empty content declarations:
    // content: "" | '' | var(--tw-content);
    if (
      decl.prop === 'content' &&
      (decl.value === '""' || decl.value === "''" || decl.value === 'var(--tw-content)')
    ) {
      return
    }

    let decls = COLOR_PROPS.includes(decl.prop)
      ? colorDecls
      : decl.prop.startsWith('--')
        ? customDecls
        : otherDecls

    decls[decl.prop] ??= []
    decls[decl.prop].push(decl.value)
  })

  // Make sure that the classes sole purpose is to set a color of some kind
  // This means that the class can only contain:
  // - all known, color-based properties; OR
  // - all custom properties

  // Has unknown, non-custom properties
  if (Object.keys(otherDecls).length > 0) return []

  // Has both color and custom properties
  if (Object.keys(colorDecls).length > 0 && Object.keys(customDecls).length > 0) return []

  // Parse all colors from all declarations
  let decls = Object.keys(colorDecls).length > 0 ? colorDecls : customDecls
  let values = Object.values(decls).flat()

  if (values.length === 0) return []

  // Find all colors from the values
  let colors: (culori.Color | KeywordColor)[] = []

  for (let value of values) {
    // Skip any values that mention a shadow
    // todo: Why do we do this?
    if (SHADOW_REGEX.test(value)) continue

    // todo:
    // in:  rgb(var(--primary, 66 66 66))
    // out: rgb(66 66 66)

    for (let match of value.matchAll(COLOR_REGEX)) {
      let color = match[1]
      let keyword = getKeywordColor(color)
      if (keyword) {
        colors.push(keyword)
        continue
      }

      let parsed = culori.parse(color)
      if (parsed) {
        // Make sure an alpha value is always present as we use it later
        parsed.alpha = parsed.alpha ?? 1
        colors.push(parsed)
        continue
      }
    }
  }

  // Check that all of the values are the same color, ignoring alpha
  let strs = Array.from(
    new Set(
      colors.map((color) =>
        typeof color === 'string' ? color : culori.formatRgb({ ...color, alpha: undefined }),
      ),
    ),
  )

  // We have multiple colors and they are not all the same so bail out
  if (strs.length !== 1) return []

  // If a keyword color is found, return it
  let keyword = getKeywordColor(strs[0])
  if (keyword) return [keyword]

  // If multiple of the same color are found:
  let parsed = colors.filter((color): color is culori.Color => typeof color !== 'string')

  let alphas = new Set(parsed.map((color) => color.alpha))

  // - Return the first color if all alpha values are the same; OR
  if (alphas.size === 1) {
    return [parsed[0]]
  }

  // - When one of the alpha values is 0, return the color with a non-zero alpha
  if (alphas.size === 2 && alphas.has(0)) {
    return [parsed.find((color) => color.alpha !== 0)!]
  }

  // We've hit a case where we have multiple colors with different alpha values
  // this means there's no definitive color to return so don't return anything
  return []
}

const COLOR_MIX_REGEX = /color-mix\(in srgb, (.*?) (\d+|\.\d+|\d+\.\d+)%, transparent\)/g

export function optimizeColorMix(str: string) {
  return str.replace(COLOR_MIX_REGEX, (match, color, percentage) => {
    if (color.startsWith('var(')) return match

    let parsed = culori.parse(color)
    if (!parsed) return match

    let alpha = Number(percentage) / 100
    if (Number.isNaN(alpha)) return match

    return culori.formatRgb({ ...parsed, alpha })
  })
}
