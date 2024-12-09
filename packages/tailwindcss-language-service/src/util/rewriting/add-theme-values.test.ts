import { expect, test } from 'vitest'
import { State, TailwindCssSettings } from '../state'
import { DesignSystem } from '../v4'
import { addThemeValues } from './add-theme-values'

test('Inlicing calc expressions using the design system', () => {
  let map = new Map<string, string>([['--spacing', '0.25rem']])

  let state: State = {
    enabled: true,
    designSystem: {
      resolveThemeValue: (name) => map.get(name) ?? null,
    } as DesignSystem,
  }

  let settings: TailwindCssSettings = {
    rootFontSize: 10,
  } as any

  expect(addThemeValues('calc(var(--spacing) * 4)', state, settings)).toBe('1rem')
})
