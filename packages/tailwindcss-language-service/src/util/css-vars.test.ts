import { expect, test } from 'vitest'
import { replaceCssVarsWithFallbacks } from './css-vars'

test('replacing CSS variables with their fallbacks (when they have them)', () => {
  expect(replaceCssVarsWithFallbacks('var(--foo, red)')).toBe(' red')
  expect(replaceCssVarsWithFallbacks('var(--foo, )')).toBe(' ')

  expect(replaceCssVarsWithFallbacks('rgb(var(--foo, 255 0 0))')).toBe('rgb( 255 0 0)')
  expect(replaceCssVarsWithFallbacks('rgb(var(--foo, var(--bar)))')).toBe('rgb( var(--bar))')

  expect(
    replaceCssVarsWithFallbacks('rgb(var(var(--bar, var(--baz), var(--qux), var(--thing))))'),
  ).toBe('rgb(var(var(--bar, var(--baz), var(--qux), var(--thing))))')

  expect(
    replaceCssVarsWithFallbacks(
      'rgb(var(--one, var(--bar, var(--baz), var(--qux), var(--thing))))',
    ),
  ).toBe('rgb(  var(--baz), var(--qux), var(--thing))')

  expect(
    replaceCssVarsWithFallbacks(
      'color-mix(in srgb, var(--color-primary, oklch(0 0 0 / 2.5)), var(--color-secondary, oklch(0 0 0 / 2.5)), 50%)',
    ),
  ).toBe('color-mix(in srgb,  oklch(0 0 0 / 2.5),  oklch(0 0 0 / 2.5), 50%)')
})
