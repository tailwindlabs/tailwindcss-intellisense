import { expect, test } from 'vitest'
import {
  addThemeValues,
  evaluateExpression,
  replaceCssCalc,
  replaceCssVarsWithFallbacks,
} from './index'
import { State, TailwindCssSettings } from '../state'
import { DesignSystem } from '../v4'

test('replacing CSS variables with their fallbacks (when they have them)', () => {
  let map = new Map<string, string>([
    ['--known', 'blue'],
    ['--level-1', 'var(--known)'],
    ['--level-2', 'var(--level-1)'],
    ['--level-3', 'var(--level-2)'],

    ['--circular-1', 'var(--circular-3)'],
    ['--circular-2', 'var(--circular-1)'],
    ['--circular-3', 'var(--circular-2)'],

    ['--escaped\\,name', 'green'],
  ])

  let state: State = {
    enabled: true,
    designSystem: {
      theme: { prefix: null } as any,
      resolveThemeValue: (name) => map.get(name) ?? null,
    } as DesignSystem,
  }

  expect(replaceCssVarsWithFallbacks(state, 'var(--foo, red)')).toBe(' red')
  expect(replaceCssVarsWithFallbacks(state, 'var(--foo, )')).toBe(' ')

  expect(replaceCssVarsWithFallbacks(state, 'rgb(var(--foo, 255 0 0))')).toBe('rgb( 255 0 0)')
  expect(replaceCssVarsWithFallbacks(state, 'rgb(var(--foo, var(--bar)))')).toBe('rgb( var(--bar))')

  expect(
    replaceCssVarsWithFallbacks(
      state,
      'rgb(var(var(--bar, var(--baz), var(--qux), var(--thing))))',
    ),
  ).toBe('rgb(var( var(--baz), var(--qux), var(--thing)))')

  expect(
    replaceCssVarsWithFallbacks(
      state,
      'rgb(var(--one, var(--bar, var(--baz), var(--qux), var(--thing))))',
    ),
  ).toBe('rgb(  var(--baz), var(--qux), var(--thing))')

  expect(
    replaceCssVarsWithFallbacks(
      state,
      'color-mix(in srgb, var(--color-primary, oklch(0 0 0 / 2.5)), var(--color-secondary, oklch(0 0 0 / 2.5)), 50%)',
    ),
  ).toBe('color-mix(in srgb,  oklch(0 0 0 / 2.5),  oklch(0 0 0 / 2.5), 50%)')

  // Known theme keys are replaced with their values
  expect(replaceCssVarsWithFallbacks(state, 'var(--known)')).toBe('blue')

  // Escaped commas are not treated as separators
  expect(replaceCssVarsWithFallbacks(state, 'var(--escaped\\,name)')).toBe('green')

  // Values from the theme take precedence over fallbacks
  expect(replaceCssVarsWithFallbacks(state, 'var(--known, red)')).toBe('blue')

  // Unknown theme keys use a fallback if provided
  expect(replaceCssVarsWithFallbacks(state, 'var(--unknown, red)')).toBe(' red')

  // Unknown theme keys without fallbacks are not replaced
  expect(replaceCssVarsWithFallbacks(state, 'var(--unknown)')).toBe('var(--unknown)')

  // Fallbacks are replaced recursively
  expect(replaceCssVarsWithFallbacks(state, 'var(--unknown,var(--unknown-2,red))')).toBe('red')
  expect(replaceCssVarsWithFallbacks(state, 'var(--level-1)')).toBe('blue')
  expect(replaceCssVarsWithFallbacks(state, 'var(--level-2)')).toBe('blue')
  expect(replaceCssVarsWithFallbacks(state, 'var(--level-3)')).toBe('blue')

  // Circular replacements don't cause infinite loops
  expect(replaceCssVarsWithFallbacks(state, 'var(--circular-1)')).toBe('var(--circular-1)')
  expect(replaceCssVarsWithFallbacks(state, 'var(--circular-2)')).toBe('var(--circular-2)')
  expect(replaceCssVarsWithFallbacks(state, 'var(--circular-3)')).toBe('var(--circular-3)')
})

test('recursive theme replacements', () => {
  let map = new Map<string, string>([
    ['--color-a', 'var(--color-a)'],
    ['--color-b', 'rgb(var(--color-b))'],
    ['--color-c', 'rgb(var(--channel) var(--channel) var(--channel))'],
    ['--channel', '255'],

    ['--color-d', 'rgb(var(--indirect) var(--indirect) var(--indirect))'],
    ['--indirect', 'var(--channel)'],
    ['--channel', '255'],

    ['--mutual-a', 'calc(var(--mutual-b) * 1)'],
    ['--mutual-b', 'calc(var(--mutual-a) + 1)'],
  ])

  let state: State = {
    enabled: true,
    designSystem: {
      theme: { prefix: null } as any,
      resolveThemeValue: (name) => map.get(name) ?? null,
    } as DesignSystem,
  }

  expect(replaceCssVarsWithFallbacks(state, 'var(--color-a)')).toBe('var(--color-a)')
  expect(replaceCssVarsWithFallbacks(state, 'var(--color-b)')).toBe('rgb(var(--color-b))')
  expect(replaceCssVarsWithFallbacks(state, 'var(--color-c)')).toBe('rgb(255 255 255)')

  // This one is wrong but fixing it without breaking the infinite recursion guard is complex
  expect(replaceCssVarsWithFallbacks(state, 'var(--color-d)')).toBe(
    'rgb(255 var(--indirect) var(--indirect))',
  )

  expect(replaceCssVarsWithFallbacks(state, 'var(--mutual-a)')).toBe(
    'calc(calc(var(--mutual-a) + 1) * 1)',
  )
  expect(replaceCssVarsWithFallbacks(state, 'var(--mutual-b)')).toBe(
    'calc(calc(var(--mutual-b) * 1) + 1)',
  )
})

test('Evaluating CSS calc expressions', () => {
  expect(replaceCssCalc('calc(1px + 1px)', (node) => evaluateExpression(node.value))).toBe('2px')
  expect(replaceCssCalc('calc(1px * 4)', (node) => evaluateExpression(node.value))).toBe('4px')
  expect(replaceCssCalc('calc(1px / 4)', (node) => evaluateExpression(node.value))).toBe('0.25px')
  expect(replaceCssCalc('calc(1rem + 1px)', (node) => evaluateExpression(node.value))).toBe(
    'calc(1rem + 1px)',
  )

  expect(replaceCssCalc('calc(1.25 / 0.875)', (node) => evaluateExpression(node.value))).toBe(
    '1.4286',
  )

  expect(replaceCssCalc('calc(1/4 * 100%)', (node) => evaluateExpression(node.value))).toBe('25%')
})

test('Inlining calc expressions using the design system', () => {
  let map = new Map<string, string>([
    ['--spacing', '0.25rem'],
    ['--color-red-500', 'oklch(0.637 0.237 25.331)'],
  ])

  let state: State = {
    enabled: true,
    designSystem: {
      theme: { prefix: null } as any,
      resolveThemeValue: (name) => map.get(name) ?? null,
    } as DesignSystem,
  }

  let settings: TailwindCssSettings = {
    rootFontSize: 10,
  } as any

  // Inlining calc expressions
  // + pixel equivalents
  expect(addThemeValues('calc(var(--spacing) * 4)', state, settings)).toBe(
    'calc(var(--spacing) * 4) /* 1rem = 10px */',
  )

  expect(addThemeValues('calc(var(--spacing) / 4)', state, settings)).toBe(
    'calc(var(--spacing) / 4) /* 0.0625rem = 0.625px */',
  )

  expect(addThemeValues('calc(var(--spacing) * 1)', state, settings)).toBe(
    'calc(var(--spacing) * 1) /* 0.25rem = 2.5px */',
  )

  expect(addThemeValues('calc(var(--spacing) * -1)', state, settings)).toBe(
    'calc(var(--spacing) * -1) /* -0.25rem = -2.5px */',
  )

  expect(addThemeValues('calc(var(--spacing) + 1rem)', state, settings)).toBe(
    'calc(var(--spacing) + 1rem) /* 1.25rem = 12.5px */',
  )

  expect(addThemeValues('calc(var(--spacing) - 1rem)', state, settings)).toBe(
    'calc(var(--spacing) - 1rem) /* -0.75rem = -7.5px */',
  )

  expect(addThemeValues('calc(var(--spacing) + 1px)', state, settings)).toBe(
    'calc(var(--spacing) /* 0.25rem = 2.5px */ + 1px)',
  )

  // Color equivalents
  expect(addThemeValues('var(--color-red-500)', state, settings)).toBe(
    'var(--color-red-500) /* oklch(0.637 0.237 25.331) = #fb2c36 */',
  )
})
