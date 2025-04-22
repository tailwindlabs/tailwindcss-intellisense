import * as culori from 'culori'
import { expect, test } from 'vitest'
import { colorFromString, colorMix, colorMixFromString } from './color'

test('colorFromString', () => {
  expect(colorFromString('red')).toEqual({ mode: 'rgb', r: 1, g: 0, b: 0 })
  expect(colorFromString('rgb(255 0 0)')).toEqual({ mode: 'rgb', r: 1, g: 0, b: 0 })
  expect(colorFromString('hsl(0 100% 50%)')).toEqual({ mode: 'hsl', h: 0, s: 1, l: 0.5 })
  expect(colorFromString('#f00')).toEqual({ mode: 'rgb', r: 1, g: 0, b: 0 })
  expect(colorFromString('#f003')).toEqual({ mode: 'rgb', r: 1, g: 0, b: 0, alpha: 0.2 })
  expect(colorFromString('#ff0000')).toEqual({ mode: 'rgb', r: 1, g: 0, b: 0 })
  expect(colorFromString('#ff000033')).toEqual({ mode: 'rgb', r: 1, g: 0, b: 0, alpha: 0.2 })

  expect(colorFromString('color(srgb 1 0 0 )')).toEqual({ mode: 'rgb', r: 1, g: 0, b: 0 })
  expect(colorFromString('color(srgb-linear 1 0 0 )')).toEqual({ mode: 'lrgb', r: 1, g: 0, b: 0 })
  expect(colorFromString('color(display-p3 1 0 0 )')).toEqual({ mode: 'p3', r: 1, g: 0, b: 0 })
  expect(colorFromString('color(a98-rgb 1 0 0 )')).toEqual({ mode: 'a98', r: 1, g: 0, b: 0 })
  expect(colorFromString('color(prophoto-rgb 1 0 0 )')).toEqual({
    mode: 'prophoto',
    r: 1,
    g: 0,
    b: 0,
  })
  expect(colorFromString('color(rec2020 1 0 0 )')).toEqual({ mode: 'rec2020', r: 1, g: 0, b: 0 })

  expect(colorFromString('color(xyz 1 0 0 )')).toEqual({ mode: 'xyz65', x: 1, y: 0, z: 0 })
  expect(colorFromString('color(xyz-d65 1 0 0 )')).toEqual({ mode: 'xyz65', x: 1, y: 0, z: 0 })
  expect(colorFromString('color(xyz-d50 1 0 0 )')).toEqual({ mode: 'xyz50', x: 1, y: 0, z: 0 })

  expect(colorFromString('#ff000033cccc')).toEqual(null)

  // none keywords work too
  expect(colorFromString('rgb(255 none 0)')).toEqual({ mode: 'rgb', r: 1, b: 0 })
})

test('colorMixFromString', () => {
  expect(colorMixFromString('color-mix(in srgb, #f00 50%, transparent)')).toEqual({
    mode: 'rgb',
    r: 1,
    g: 0,
    b: 0,
    alpha: 0.5,
  })
})
