import { expect, test } from 'vitest'
import { State, TailwindCssSettings } from '../state'
import { DesignSystem } from '../v4'
import { process, ProcessOptions } from './process'

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

  let opts: ProcessOptions = {
    style: 'full-evaluation',
    fontSize: 16,
    state: {
      enabled: true,
      designSystem: {
        theme: { prefix: null } as any,
        resolveThemeValue: (name) => map.get(name) ?? null,
      } as DesignSystem,
    } as State,
  }

  expect(process('var(--foo, red)', opts)).toBe(' red')
  expect(process('var(--foo, )', opts)).toBe(' ')

  expect(process('rgb(var(--foo, 255 0 0))', opts)).toBe('rgb( 255 0 0)')
  expect(process('rgb(var(--foo, var(--bar)))', opts)).toBe('rgb( var(--bar))')

  expect(process('rgb(var(var(--bar, var(--baz), var(--qux), var(--thing))))', opts)).toBe(
    'rgb( var(--qux), var(--thing))',
  )

  expect(process('rgb(var(--one, var(--bar, var(--baz), var(--qux), var(--thing))))', opts)).toBe(
    'rgb(  var(--baz), var(--qux), var(--thing))',
  )

  expect(
    process(
      'color-mix(in srgb, var(--color-primary, oklch(0 0 0 / 2.5)), var(--color-secondary, oklch(0 0 0 / 2.5)), 50%)',
      opts,
    ),
  ).toBe('color-mix(in srgb,  oklch(0 0 0 / 2.5),  oklch(0 0 0 / 2.5), 50%)')

  // Known theme keys are replaced with their values
  expect(process('var(--known)', opts)).toBe('blue')

  // Escaped commas are not treated as separators
  expect(process('var(--escaped\\,name)', opts)).toBe('green')

  // Values from the theme take precedence over fallbacks
  expect(process('var(--known, red)', opts)).toBe('blue')

  // Unknown theme keys use a fallback if provided
  expect(process('var(--unknown, red)', opts)).toBe(' red')

  // Unknown theme keys without fallbacks are not replaced
  expect(process('var(--unknown)', opts)).toBe('var(--unknown)')

  // Fallbacks are replaced recursively
  expect(process('var(--unknown,var(--unknown-2,red))', opts)).toBe('red')
  expect(process('var(--level-1)', opts)).toBe('blue')
  expect(process('var(--level-2)', opts)).toBe('blue')
  expect(process('var(--level-3)', opts)).toBe('blue')

  // Circular replacements don't cause infinite loops
  expect(process('var(--circular-1)', opts)).toBe('var(--circular-3)')
  expect(process('var(--circular-2)', opts)).toBe('var(--circular-1)')
  expect(process('var(--circular-3)', opts)).toBe('var(--circular-2)')
})

test('Evaluating CSS calc expressions', () => {
  let opts: ProcessOptions = {
    style: 'full-evaluation',
    fontSize: 16,
    state: {
      enabled: true,
      designSystem: {
        theme: { prefix: null } as any,
        resolveThemeValue: (name) => null,
      } as DesignSystem,
    } as State,
  }

  expect(process('calc(1px + 1px)', opts)).toBe('2px')
  expect(process('calc(1px * 4)', opts)).toBe('4px')
  expect(process('calc(1px / 4)', opts)).toBe('0.25px')
  expect(process('calc(1rem + 1px)', opts)).toBe('calc(1rem /* 1rem = 16px */ + 1px)')
  expect(process('calc(1.25 / 0.875)', opts)).toBe('1.4286')
  expect(process('calc(1/4 * 100%)', opts)).toBe('25%')
})

test('Inlining calc expressions using the design system', () => {
  let map = new Map<string, string>([
    ['--spacing', '0.25rem'],
    ['--color-red-500', 'oklch(0.637 0.237 25.331)'],
  ])

  let opts: ProcessOptions = {
    style: 'user-presetable',
    fontSize: 16,
    state: {
      enabled: true,
      designSystem: {
        theme: { prefix: null } as any,
        resolveThemeValue: (name) => map.get(name) ?? null,
      } as DesignSystem,
    } as State,
  }

  // Inlining calc expressions
  // + pixel equivalents
  expect(process('calc(var(--spacing) * 4)', opts)).toBe(
    'calc(var(--spacing) * 4) /* 1rem = 10px */',
  )

  expect(process('calc(var(--spacing) / 4)', opts)).toBe(
    'calc(var(--spacing) / 4) /* 0.0625rem = 0.625px */',
  )

  expect(process('calc(var(--spacing) * 1)', opts)).toBe(
    'calc(var(--spacing) * 1) /* 0.25rem = 2.5px */',
  )

  expect(process('calc(var(--spacing) * -1)', opts)).toBe(
    'calc(var(--spacing) * -1) /* -0.25rem = -2.5px */',
  )

  expect(process('calc(var(--spacing) + 1rem)', opts)).toBe(
    'calc(var(--spacing) + 1rem) /* 1.25rem = 12.5px */',
  )

  expect(process('calc(var(--spacing) - 1rem)', opts)).toBe(
    'calc(var(--spacing) - 1rem) /* -0.75rem = -7.5px */',
  )

  expect(process('calc(var(--spacing) + 1px)', opts)).toBe(
    'calc(var(--spacing) /* 0.25rem = 2.5px */ + 1px)',
  )

  // Color equivalents
  expect(process('var(--color-red-500)', opts)).toBe(
    'var(--color-red-500) /* oklch(0.637 0.237 25.331) = #fb2c36 */',
  )
})

test('wip', () => {
  let map = new Map<string, string>([
    //
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
  ])

  let opts: ProcessOptions = {
    style: 'full-evaluation',
    fontSize: 16,
    state: {
      enabled: true,
      designSystem: {
        theme: { prefix: null } as any,
        resolveThemeValue: (name) => map.get(name) ?? null,
      } as DesignSystem,
    } as State,
  }

  expect(process('var(--known)', opts)).toBe('1px solid a b c d e f 21px f e d c b a')
  expect(process('var(--known-2)', opts)).toBe('rgba(0, 255, 0, 0.25)')

  expect(process('var(--tw-text-shadow-alpha)', opts)).toBe('100%')
  expect(process('var(--tw-drop-shadow-alpha)', opts)).toBe('100%')
  expect(process('var(--tw-shadow-alpha)', opts)).toBe('100%')
  expect(process('1rem', opts)).toBe('1rem /* 1rem = 16px */')
})
