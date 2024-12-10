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
  let map = new Map<string, string>([['--known', 'blue']])

  let state: State = {
    enabled: true,
    designSystem: {
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

  // Values from the theme take precedence over fallbacks
  expect(replaceCssVarsWithFallbacks(state, 'var(--known, red)')).toBe('blue')

  // Unknown theme keys use a fallback if provided
  expect(replaceCssVarsWithFallbacks(state, 'var(--unknown, red)')).toBe(' red')

  // Unknown theme keys without fallbacks are not replaced
  expect(replaceCssVarsWithFallbacks(state, 'var(--unknown)')).toBe('var(--unknown)')
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
})

test('Inlining calc expressions using the design system', () => {
  let map = new Map<string, string>([
    ['--spacing', '0.25rem'],
    ['--color-red-500', 'oklch(0.637 0.237 25.331)'],
  ])

  let state: State = {
    enabled: true,
    designSystem: {
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
