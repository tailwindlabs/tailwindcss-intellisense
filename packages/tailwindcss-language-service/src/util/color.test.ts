import { test, expect } from 'vitest'
import namedColors from 'color-name'
import { findColors } from './color'

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
