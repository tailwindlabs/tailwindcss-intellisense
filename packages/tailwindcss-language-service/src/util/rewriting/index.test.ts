import { expect, test } from 'vitest'
import { createProcessor } from './process'

// Cyclic variables
// None of these should ever get replaced
// ['--color-a', 'var(--color-a)'],
// ['--color-b', 'rgb(var(--color-b))'],
// ['--color-c', 'rgb(var(--color-c) var(--color-c) var(--color-c))'],

// ['--mutual-a', 'calc(var(--mutual-b) * 1)'],
// ['--mutual-b', 'calc(var(--mutual-a) + 1)'],

// ['--circle-cw-1', 'var(--circle-cw-2)'],
// ['--circle-cw-2', 'var(--circle-cw-3)'],
// ['--circle-cw-3', 'var(--circle-cw-1)'],

// ['--circle-ccw-1', 'var(--circle-ccw-3)'],
// ['--circle-ccw-2', 'var(--circle-ccw-1)'],
// ['--circle-ccw-3', 'var(--circle-ccw-2)'],

// // None of these are cyclic and should all have replacements
// ['--color-d', 'rgb(var(--channel) var(--channel) var(--channel))'],
// ['--color-e', 'rgb(var(--indirect) var(--indirect) var(--indirect))'],
// ['--indirect', 'var(--channel)'],
// ['--channel', '255'],

test('replacing CSS variables with their fallbacks (when they have them)', () => {
  let process = createProcessor({
    style: 'full-evaluation',
    fontSize: 16,
    variables: new Map<string, string>([
      ['--known', 'blue'],
      ['--level-1', 'var(--known)'],
      ['--level-2', 'var(--level-1)'],
      ['--level-3', 'var(--level-2)'],

      ['--circular-1', 'var(--circular-3)'],
      ['--circular-2', 'var(--circular-1)'],
      ['--circular-3', 'var(--circular-2)'],

      ['--escaped\\,name', 'green'],
    ]),
  })

  expect(process('var(--foo, red)')).toBe(' red')
  expect(process('var(--foo, )')).toBe(' ')

  expect(process('rgb(var(--foo, 255 0 0))')).toBe('rgb( 255 0 0)')
  expect(process('rgb(var(--foo, var(--bar)))')).toBe('rgb( var(--bar))')

  expect(process('rgb(var(var(--bar, var(--baz), var(--qux), var(--thing))))')).toBe(
    'rgb( var(--qux), var(--thing))',
  )

  expect(process('rgb(var(--one, var(--bar, var(--baz), var(--qux), var(--thing))))')).toBe(
    'rgb(  var(--baz), var(--qux), var(--thing))',
  )

  expect(
    process(
      'color-mix(in srgb, var(--color-primary, oklch(0 0 0 / 2.5)), var(--color-secondary, oklch(0 0 0 / 2.5)) 50%)',
    ),
  ).toBe('rgb(0, 0, 0)')

  expect(
    process(
      'color-mix(in oklch, var(--color-primary, oklch(0.64 0.2935 27 / 0.5)), var(--color-secondary, oklch(0.64 0.2195 247.76)) 50%)',
    ),
  ).toBe('rgba(197, 73, 234, 0.75)')

  // Known theme keys are replaced with their values
  expect(process('var(--known)')).toBe('blue')

  // Escaped commas are not treated as separators
  expect(process('var(--escaped\\,name)')).toBe('green')

  // Values from the theme take precedence over fallbacks
  expect(process('var(--known, red)')).toBe('blue')

  // Unknown theme keys use a fallback if provided
  expect(process('var(--unknown, red)')).toBe(' red')

  // Unknown theme keys without fallbacks are not replaced
  expect(process('var(--unknown)')).toBe('var(--unknown)')

  // Fallbacks are replaced recursively
  expect(process('var(--unknown,var(--unknown-2,red))')).toBe('red')
  expect(process('var(--level-1)')).toBe('blue')
  expect(process('var(--level-2)')).toBe('blue')
  expect(process('var(--level-3)')).toBe('blue')

  // Circular replacements don't cause infinite loops
  expect(process('var(--circular-1)')).toBe('var(--circular-3)')
  expect(process('var(--circular-2)')).toBe('var(--circular-1)')
  expect(process('var(--circular-3)')).toBe('var(--circular-2)')
})

test('recursive theme replacements', () => {
  let process = createProcessor({
    style: 'full-evaluation',
    fontSize: 16,
    variables: new Map<string, string>([
      // Cyclic variables
      ['--color-a', 'var(--color-a)'],
      ['--color-b', 'rgb(var(--color-b))'],
      ['--color-c', 'rgb(var(--color-c) var(--color-c) var(--color-c))'],

      ['--mutual-a', 'calc(var(--mutual-b) * 1)'],
      ['--mutual-b', 'calc(var(--mutual-a) + 1)'],

      ['--circle-cw-1', 'var(--circle-cw-2)'],
      ['--circle-cw-2', 'var(--circle-cw-3)'],
      ['--circle-cw-3', 'var(--circle-cw-1)'],

      ['--circle-ccw-1', 'var(--circle-ccw-3)'],
      ['--circle-ccw-2', 'var(--circle-ccw-1)'],
      ['--circle-ccw-3', 'var(--circle-ccw-2)'],
    ]),
  })

  expect(process('var(--color-a)')).toBe('var(--color-a)')
  expect(process('var(--color-b)')).toBe('rgb(var(--color-b))')
  expect(process('var(--color-c)')).toBe('rgb(var(--color-c) var(--color-c) var(--color-c))')

  expect(process('var(--mutual-a)')).toBe('calc(var(--mutual-b) * 1)')
  expect(process('var(--mutual-b)')).toBe('calc(var(--mutual-a) + 1)')

  expect(process('var(--circle-cw-1)')).toBe('var(--circle-cw-2)')
  expect(process('var(--circle-cw-2)')).toBe('var(--circle-cw-3)')
  expect(process('var(--circle-cw-3)')).toBe('var(--circle-cw-1)')

  expect(process('var(--circle-ccw-1)')).toBe('var(--circle-ccw-3)')
  expect(process('var(--circle-ccw-2)')).toBe('var(--circle-ccw-1)')
  expect(process('var(--circle-ccw-3)')).toBe('var(--circle-ccw-2)')
})

test('Evaluating CSS calc expressions', () => {
  let process = createProcessor({
    style: 'full-evaluation',
    fontSize: 16,
    variables: new Map(),
  })

  expect(process('calc(1/4 * 100%)')).toBe('25%')
  expect(process('calc(1px + 1px)')).toBe('2px')
  expect(process('calc(1px * 4)')).toBe('4px')
  expect(process('calc(1px / 4)')).toBe('0.25px')
  expect(process('calc(1rem + 1px)')).toBe('calc(1rem + 1px)')
  expect(process('calc(1.25 / 0.875)')).toBe('1.428571')
  expect(process('calc(1/4 * 100%)')).toBe('25%')
  expect(process('calc(0.12345rem * 0.5)')).toBe('0.061725rem')
  expect(process('calc(0.12345789rem * 0.5)')).toBe('0.061729rem')
})

test('Inlining calc expressions using the design system', () => {
  let process = createProcessor({
    style: 'user-presentable',

    fontSize: 10,
    variables: new Map([
      ['--spacing', '0.25rem'],
      ['--color-red-500', 'oklch(0.637 0.237 25.331)'],
    ]),
  })

  // Inlining calc expressions
  // + pixel equivalents
  expect(process('calc(var(--spacing) * 4)')).toBe('calc(var(--spacing) * 4) /* 1rem = 10px */')

  expect(process('calc(var(--spacing) / 4)')).toBe(
    'calc(var(--spacing) / 4) /* 0.0625rem = 0.625px */',
  )

  expect(process('calc(var(--spacing) * 1)')).toBe('calc(var(--spacing) * 1) /* 0.25rem = 2.5px */')

  expect(process('calc(var(--spacing) * -1)')).toBe(
    'calc(var(--spacing) * -1) /* -0.25rem = -2.5px */',
  )

  expect(process('calc(var(--spacing) + 1rem)')).toBe(
    'calc(var(--spacing) + 1rem) /* 1.25rem = 12.5px */',
  )

  expect(process('calc(var(--spacing) - 1rem)')).toBe(
    'calc(var(--spacing) - 1rem) /* -0.75rem = -7.5px */',
  )

  expect(process('calc(var(--spacing) + 1px)')).toBe(
    'calc(var(--spacing) /* 0.25rem = 2.5px */ + 1px)',
  )

  // Color equivalents
  expect(process('var(--color-red-500)')).toBe(
    'var(--color-red-500) /* oklch(0.637 0.237 25.331) = #fb2c36 */',
  )
})

test('wip', () => {
  let process = createProcessor({
    style: 'full-evaluation',
    fontSize: 16,
    variables: new Map([
      ['--known', '1px solid var(--level-1)'],
      ['--level-1', 'a theme(--level-2) a'],
      ['--level-2', 'b var(--level-3) b'],
      ['--level-3', 'c theme(--level-4) c'],
      ['--level-4', 'd var(--level-5) d'],
      ['--level-5', 'e light-dark(var(--level-6), blue) e'],
      ['--level-6', 'f calc(3 * var(--idk, 7px)) f'],

      ['--a', '0.5'],
      ['--b', '255'],
      ['--c', '50%'],
      ['--known-2', 'color-mix(in srgb, rgb(0 var(--b) 0 / var(--a)) var(--c), transparent)'],
    ]),
  })

  expect(process('var(--known)')).toBe('1px solid a b c d e f 21px f e d c b a')
  expect(process('var(--known-2)')).toBe('rgba(0, 255, 0, 0.25)')

  expect(process('var(--tw-text-shadow-alpha)')).toBe('100%')
  expect(process('var(--tw-drop-shadow-alpha)')).toBe('100%')
  expect(process('var(--tw-shadow-alpha)')).toBe('100%')
  expect(process('1rem')).toBe('1rem /* 1rem = 16px */')
})
