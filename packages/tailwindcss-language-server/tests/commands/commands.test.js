import { test, expect } from 'vitest'
import { withFixture } from '../common'

withFixture('basic', (c) => {
  test.concurrent('sortSelection', async ({ expect }) => {
    let textDocument = await c.openDocument({ text: '<div class="sm:p-0 p-0">' })
    let res = await c.sendRequest('@/tailwindCSS/sortSelection', {
      uri: textDocument.uri,
      classLists: ['sm:p-0 p-0'],
    })

    expect(res).toEqual({ classLists: ['p-0 sm:p-0'] })
  })
})

withFixture('v4/basic', (c) => {
  test.concurrent('sortSelection', async ({ expect }) => {
    let textDocument = await c.openDocument({ text: '<div class="sm:p-0 p-0">' })
    let res = await c.sendRequest('@/tailwindCSS/sortSelection', {
      uri: textDocument.uri,
      classLists: ['sm:p-0 p-0'],
    })

    expect(res).toEqual({ classLists: ['p-0 sm:p-0'] })
  })
})
