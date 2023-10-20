import { expect, test } from 'vitest'
import { parse } from 'postcss'
import extractClassNames from './extractClassNames'

test('ex: 1', async () => {
  let result = await extractClassNames(parse('.foo {}'))

  expect(result.classNames).toHaveProperty('foo')
  expect(result.classNames['foo']).toEqual({
    __info: {
      __rule: true,
      __source: undefined,
      __pseudo: [],
      __scope: null,
      __context: [],
    },
  })
})

test('ex: 2', async () => {
  let result = await extractClassNames(parse('.foo.bar {}'))

  expect(result.classNames).toHaveProperty('foo')
  expect(result.classNames).toHaveProperty('bar')
  expect(result.classNames['foo']).toEqual({
    __info: {
      __source: undefined,
      __pseudo: [],
      __scope: null,
      __context: [],
    },
  })
  expect(result.classNames['bar']).toEqual({
    __info: {
      __rule: true,
      __source: undefined,
      __pseudo: [],
      __scope: '.foo',
      __context: [],
    },
  })
})

test('ex: 3', async () => {
  let result = await extractClassNames(parse('.foo:where(.bar:is(.baz:has(> .klass))) {}'))

  expect(result.classNames).toHaveProperty('foo')
  expect(result.classNames).not.toHaveProperty('bar')
  expect(result.classNames).not.toHaveProperty('baz')
  expect(result.classNames).not.toHaveProperty('klass')
  expect(result.classNames['foo']).toEqual({
    __info: {
      __rule: true,
      __source: undefined,
      __pseudo: [':where(.bar:is(.baz:has(> .klass)))'],
      __scope: null,
      __context: [],
    },
  })
})
