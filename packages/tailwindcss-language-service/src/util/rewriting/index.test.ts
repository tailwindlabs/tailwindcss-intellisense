import { expect, test } from 'vitest'
import { replaceCssVarsWithFallbacks } from './index'
import { State } from '../state'
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
  ).toBe('rgb(var(var(--bar, var(--baz), var(--qux), var(--thing))))')

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
