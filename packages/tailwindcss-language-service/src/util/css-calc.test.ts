import { expect, test } from 'vitest'
import { evaluateExpression, inlineCalc, replaceCssCalc } from './css-calc'
import { replaceCssVars } from './css-vars'
import { State } from './state'
import { DesignSystem } from './v4'

test('Evaluating CSS calc expressions', () => {
  expect(replaceCssCalc('calc(1px + 1px)', evaluateExpression)).toBe('2px')
  expect(replaceCssCalc('calc(1px * 4)', evaluateExpression)).toBe('4px')
  expect(replaceCssCalc('calc(1px / 4)', evaluateExpression)).toBe('0.25px')
  expect(replaceCssCalc('calc(1rem + 1px)', evaluateExpression)).toBe('calc(1rem + 1px)')
})

test('Inlicing calc expressions using the design system', () => {
  let map = new Map<string, string>([['--spacing', '0.25rem']])

  let state: State = {
    enabled: true,
    designSystem: {
      resolveThemeValue: (name) => map.get(name) ?? null,
    } as DesignSystem,
  }

  expect(inlineCalc(state, 'calc(var(--spacing) * 4)')).toBe('1rem')
  expect(inlineCalc(state, 'calc(var(--spacing) / 4)')).toBe('0.0625rem')
})
