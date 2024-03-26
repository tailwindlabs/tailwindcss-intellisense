import { test } from 'vitest'
import { withFixture } from '../common'

withFixture('basic', (c) => {
  test.concurrent('theme color', async ({ expect }) => {
    let textDocument = await c.openDocument({ text: '<div class="bg-red-500">' })
    let res = await c.sendRequest('textDocument/colorPresentation', {
      color: { red: 1, green: 0, blue: 0, alpha: 1 },
      textDocument,
      range: {
        start: { line: 0, character: 12 },
        end: { line: 0, character: 22 },
      },
    })

    expect(res).toEqual([])
  })

  test.concurrent('arbitrary named color', async ({ expect }) => {
    let textDocument = await c.openDocument({ text: '<div class="bg-[red]">' })
    let res = await c.sendRequest('textDocument/colorPresentation', {
      color: { red: 1, green: 0, blue: 0, alpha: 1 },
      textDocument,
      range: {
        start: { line: 0, character: 12 },
        end: { line: 0, character: 20 },
      },
    })

    expect(res).toEqual([
      { label: 'bg-[#ff0000]' },
      { label: 'bg-[rgb(255,0,0)]' },
      { label: 'bg-[hsl(0,100%,50%)]' },
    ])
  })

  test.concurrent('arbitrary short hex color', async ({ expect }) => {
    let textDocument = await c.openDocument({ text: '<div class="bg-[#f00]">' })
    let res = await c.sendRequest('textDocument/colorPresentation', {
      color: { red: 1, green: 0, blue: 0, alpha: 1 },
      textDocument,
      range: {
        start: { line: 0, character: 12 },
        end: { line: 0, character: 21 },
      },
    })

    expect(res).toEqual([
      { label: 'bg-[#f00]' },
      { label: 'bg-[rgb(255,0,0)]' },
      { label: 'bg-[hsl(0,100%,50%)]' },
    ])
  })

  test.concurrent('arbitrary hex color', async ({ expect }) => {
    let textDocument = await c.openDocument({ text: '<div class="bg-[#ff0000]">' })
    let res = await c.sendRequest('textDocument/colorPresentation', {
      color: { red: 1, green: 0, blue: 0, alpha: 1 },
      textDocument,
      range: {
        start: { line: 0, character: 12 },
        end: { line: 0, character: 24 },
      },
    })

    expect(res).toEqual([
      { label: 'bg-[#ff0000]' },
      { label: 'bg-[rgb(255,0,0)]' },
      { label: 'bg-[hsl(0,100%,50%)]' },
    ])
  })

  test.concurrent('arbitrary rgb color', async ({ expect }) => {
    let textDocument = await c.openDocument({ text: '<div class="bg-[rgb(255,0,0)]">' })
    let res = await c.sendRequest('textDocument/colorPresentation', {
      color: { red: 1, green: 0, blue: 0, alpha: 1 },
      textDocument,
      range: {
        start: { line: 0, character: 12 },
        end: { line: 0, character: 29 },
      },
    })

    expect(res).toEqual([
      { label: 'bg-[#ff0000]' },
      { label: 'bg-[rgb(255,0,0)]' },
      { label: 'bg-[hsl(0,100%,50%)]' },
    ])
  })

  test.concurrent('arbitrary hsl color', async ({ expect }) => {
    let textDocument = await c.openDocument({ text: '<div class="bg-[hsl(0,100%,50%)]">' })
    let res = await c.sendRequest('textDocument/colorPresentation', {
      color: { red: 1, green: 0, blue: 0, alpha: 1 },
      textDocument,
      range: {
        start: { line: 0, character: 12 },
        end: { line: 0, character: 32 },
      },
    })

    expect(res).toEqual([
      { label: 'bg-[#ff0000]' },
      { label: 'bg-[rgb(255,0,0)]' },
      { label: 'bg-[hsl(0,100%,50%)]' },
    ])
  })

  test.concurrent('arbitrary oklch color', async ({ expect }) => {
    let textDocument = await c.openDocument({ text: '<div class="bg-[oklch(44.05%_0.16_303)]">' })
    let res = await c.sendRequest('textDocument/colorPresentation', {
      color: { red: 1, green: 0, blue: 0, alpha: 1 },
      textDocument,
      range: {
        start: { line: 0, character: 12 },
        end: { line: 0, character: 39 },
      },
    })

    expect(res).toEqual([])
  })
})

withFixture('v4/basic', (c) => {
  test.concurrent('theme color', async ({ expect }) => {
    let textDocument = await c.openDocument({ text: '<div class="bg-red-500">' })
    let res = await c.sendRequest('textDocument/colorPresentation', {
      color: { red: 1, green: 0, blue: 0, alpha: 1 },
      textDocument,
      range: {
        start: { line: 0, character: 12 },
        end: { line: 0, character: 22 },
      },
    })

    expect(res).toEqual([])
  })

  test.concurrent('arbitrary named color', async ({ expect }) => {
    let textDocument = await c.openDocument({ text: '<div class="bg-[red]">' })
    let res = await c.sendRequest('textDocument/colorPresentation', {
      color: { red: 1, green: 0, blue: 0, alpha: 1 },
      textDocument,
      range: {
        start: { line: 0, character: 12 },
        end: { line: 0, character: 20 },
      },
    })

    expect(res).toEqual([
      { label: 'bg-[#ff0000]' },
      { label: 'bg-[rgb(255,0,0)]' },
      { label: 'bg-[hsl(0,100%,50%)]' },
    ])
  })

  test.concurrent('arbitrary short hex color', async ({ expect }) => {
    let textDocument = await c.openDocument({ text: '<div class="bg-[#f00]">' })
    let res = await c.sendRequest('textDocument/colorPresentation', {
      color: { red: 1, green: 0, blue: 0, alpha: 1 },
      textDocument,
      range: {
        start: { line: 0, character: 12 },
        end: { line: 0, character: 21 },
      },
    })

    expect(res).toEqual([
      { label: 'bg-[#f00]' },
      { label: 'bg-[rgb(255,0,0)]' },
      { label: 'bg-[hsl(0,100%,50%)]' },
    ])
  })

  test.concurrent('arbitrary hex color', async ({ expect }) => {
    let textDocument = await c.openDocument({ text: '<div class="bg-[#ff0000]">' })
    let res = await c.sendRequest('textDocument/colorPresentation', {
      color: { red: 1, green: 0, blue: 0, alpha: 1 },
      textDocument,
      range: {
        start: { line: 0, character: 12 },
        end: { line: 0, character: 24 },
      },
    })

    expect(res).toEqual([
      { label: 'bg-[#ff0000]' },
      { label: 'bg-[rgb(255,0,0)]' },
      { label: 'bg-[hsl(0,100%,50%)]' },
    ])
  })

  test.concurrent('arbitrary rgb color', async ({ expect }) => {
    let textDocument = await c.openDocument({ text: '<div class="bg-[rgb(255,0,0)]">' })
    let res = await c.sendRequest('textDocument/colorPresentation', {
      color: { red: 1, green: 0, blue: 0, alpha: 1 },
      textDocument,
      range: {
        start: { line: 0, character: 12 },
        end: { line: 0, character: 29 },
      },
    })

    expect(res).toEqual([
      { label: 'bg-[#ff0000]' },
      { label: 'bg-[rgb(255,0,0)]' },
      { label: 'bg-[hsl(0,100%,50%)]' },
    ])
  })

  test.concurrent('arbitrary hsl color', async ({ expect }) => {
    let textDocument = await c.openDocument({ text: '<div class="bg-[hsl(0,100%,50%)]">' })
    let res = await c.sendRequest('textDocument/colorPresentation', {
      color: { red: 1, green: 0, blue: 0, alpha: 1 },
      textDocument,
      range: {
        start: { line: 0, character: 12 },
        end: { line: 0, character: 32 },
      },
    })

    expect(res).toEqual([
      { label: 'bg-[#ff0000]' },
      { label: 'bg-[rgb(255,0,0)]' },
      { label: 'bg-[hsl(0,100%,50%)]' },
    ])
  })

  test.concurrent('arbitrary oklch color', async ({ expect }) => {
    let textDocument = await c.openDocument({ text: '<div class="bg-[oklch(44.05%_0.16_303)]">' })
    let res = await c.sendRequest('textDocument/colorPresentation', {
      color: { red: 1, green: 0, blue: 0, alpha: 1 },
      textDocument,
      range: {
        start: { line: 0, character: 12 },
        end: { line: 0, character: 39 },
      },
    })

    expect(res).toEqual([])
  })
})
