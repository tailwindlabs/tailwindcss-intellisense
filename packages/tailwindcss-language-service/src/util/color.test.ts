import { test, expect, describe } from 'vitest'
import namedColors from 'color-name'
import { findColors, resolveLightDark } from './color'

let table: string[] = []

// 1. Named colors
table.push(...Object.keys(namedColors))

// We don't show swatches for transparent colors so we don't need to detect it
// table.push('transparent')

// 2. Hex
table.push('#639')
table.push('#0000')
table.push('#7f7f7f')
table.push('#7f7f7f7f')

// 3. Legacy color syntax
for (let fn of ['rgb', 'hsl']) {
  table.push(`${fn}(0, 0, 0)`)
  table.push(`${fn}(127, 127, 127)`)

  table.push(`${fn}a(0, 0, 0, 0)`)
  table.push(`${fn}a(127, 127, 127, .5)`)
  table.push(`${fn}a(127, 127, 127, 0.5)`)
}

// 4. Modern color syntax
let numeric = ['0', '0.0', '0.3', '1.0', '50%', '1deg', '1grad', '1turn']
let alphas = ['0', '0.0', '0.3', '1.0']

let fields = [...numeric.flatMap((field) => [field, `-${field}`]), 'var(--foo)']

for (let fn of ['rgb', 'hsl', 'lab', 'lch', 'oklab', 'oklch']) {
  for (let field of fields) {
    table.push(`${fn}(${field} ${field} ${field})`)

    for (let alpha of alphas) {
      table.push(`${fn}(${field} ${field} ${field} / ${alpha})`)
    }
  }
}

// https://github.com/khalilgharbaoui/coloregex
const COLOR_REGEX = new RegExp(
  `(?<=^|[\\s(,])(#(?:[0-9a-f]{3,4}|[0-9a-f]{6,8})|(?:rgba?|hsla?|(?:ok)?(?:lab|lch))\\(\\s*(?:(?:-?[\\d.]+(?:%|deg|g?rad|turn)?|var\\([^)]+\\))(\\s*[,/]\\s*|\\s+)+){2,3}\\s*(?:-?[\\d.]+(?:%|deg|g?rad|turn)?|var\\([^)]+\\))?\\)|transparent|${Object.keys(
    namedColors,
  ).join('|')})(?=$|[\\s),])`,
  'gi',
)

function findColorsRegex(str: string): string[] {
  let matches = str.matchAll(COLOR_REGEX)
  return Array.from(matches, (match) => match[1])
}

let boundaries = ['', ' ', '(', ',']

test.for(table)('finds color: $0', (color) => {
  for (let start of boundaries) {
    for (let end of boundaries) {
      if (end === '(') end = ')'

      expect(findColors(`${start}${color}${end}`)).toEqual([color])
      expect(findColorsRegex(`${start}${color}${end}`)).toEqual([color])
    }
  }

  expect(findColors(`var(--foo, ${color})`)).toEqual([color])
  expect(findColorsRegex(`var(--foo, ${color})`)).toEqual([color])
})

test('invalid named', () => {
  expect(findColors(`blackz`)).toEqual([])
  expect(findColorsRegex(`blackz`)).toEqual([])
})

test('invalid hex', () => {
  expect(findColors(`#7f7f7fz`)).toEqual([])
  expect(findColorsRegex(`#7f7f7fz`)).toEqual([])
})

describe('resolveLightDark', () => {
  test('extracts light color by default', () => {
    const input = 'light-dark(oklch(0.5 0.1 50), oklch(0.8 0.2 60))'
    expect(resolveLightDark(input)).toBe('oklch(0.5 0.1 50)')
  })

  test('extracts light color when colorScheme is light', () => {
    const input = 'light-dark(oklch(0.5 0.1 50), oklch(0.8 0.2 60))'
    expect(resolveLightDark(input, 'light')).toBe('oklch(0.5 0.1 50)')
  })

  test('extracts dark color when colorScheme is dark', () => {
    const input = 'light-dark(oklch(0.5 0.1 50), oklch(0.8 0.2 60))'
    expect(resolveLightDark(input, 'dark')).toBe('oklch(0.8 0.2 60)')
  })

  test('handles hex colors', () => {
    const input = 'light-dark(#ffffff, #000000)'
    expect(resolveLightDark(input, 'light')).toBe('#ffffff')
    expect(resolveLightDark(input, 'dark')).toBe('#000000')
  })

  test('handles rgb colors', () => {
    const input = 'light-dark(rgb(255 255 255), rgb(0 0 0))'
    expect(resolveLightDark(input, 'light')).toBe('rgb(255 255 255)')
    expect(resolveLightDark(input, 'dark')).toBe('rgb(0 0 0)')
  })

  test('handles multiple light-dark functions in string', () => {
    const input =
      'color: light-dark(#fff, #000); background: light-dark(#eee, #111);'
    expect(resolveLightDark(input, 'light')).toBe(
      'color: #fff; background: #eee;',
    )
    expect(resolveLightDark(input, 'dark')).toBe('color: #000; background: #111;')
  })

  test('trims whitespace from colors', () => {
    const input = 'light-dark(  #ffffff  ,   #000000   )'
    expect(resolveLightDark(input, 'light')).toBe('#ffffff')
    expect(resolveLightDark(input, 'dark')).toBe('#000000')
  })

  test('returns input unchanged when no light-dark function', () => {
    const input = '#ffffff'
    expect(resolveLightDark(input, 'light')).toBe('#ffffff')
    expect(resolveLightDark(input, 'dark')).toBe('#ffffff')
  })
})
