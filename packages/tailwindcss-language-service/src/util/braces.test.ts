import { expect, test } from 'vitest'
import { expandSize } from './braces'

test('brace expansion counting', () => {
  expect(expandSize('a')).toBe(1n)
  expect(expandSize('a{b,c}d')).toBe(2n)
  expect(expandSize('{a,b}{c,d,d}')).toBe(6n)
  expect(expandSize('{a,b}{c,d,d}{e,f,g,}')).toBe(24n)
  expect(expandSize('{a,b}{c,d,d}{e,f,g,}')).toBe(24n)
  expect(expandSize('{{a,b},{c,d}}{e,f,g}')).toBe(12n)
})

test('brace expansion counting handles large ranges', () => {
  expect(expandSize('{0..100}{0..200}{0..300}{0..400}{0..500}{0..600}{0..700}')).toBe(
    517199998863222801n,
  )
})
