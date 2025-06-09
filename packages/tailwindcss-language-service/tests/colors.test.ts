import { test, expect, describe } from 'vitest'
import dedent from 'dedent'
import { createClient } from './client'

const css = dedent

const rgb = (red: number, green: number, blue: number, alpha: number = 1) => ({
  red,
  green,
  blue,
  alpha,
})

const range = (startLine: number, startCol: number, endLine: number, endCol: number) => ({
  start: { line: startLine, character: startCol },
  end: { line: endLine, character: endCol },
})

describe('v4', async () => {
  let client = await createClient({
    config: {
      kind: 'css',
      content: css`
        @theme {
          --color-black: #000;
          --color-primary: #f00;
          --color-light-dark: light-dark(#ff0000, #0000ff);
        }
      `,
    },
  })

  test('named', async () => {
    let doc = await client.open({
      lang: 'html',
      text: '<div class="bg-primary">',
    })

    expect(await doc.documentColors()).toEqual([
      //
      { range: range(0, 12, 0, 22), color: rgb(1, 0, 0) },
    ])
  })

  test('named + opacity modifier', async () => {
    let doc = await client.open({
      lang: 'html',
      text: '<div class="bg-primary/20">',
    })

    expect(await doc.documentColors()).toEqual([
      //
      { range: range(0, 12, 0, 25), color: rgb(1, 0, 0, 0.2) },
    ])
  })

  test('named + arbitrary opacity modifier', async () => {
    let doc = await client.open({
      lang: 'html',
      text: '<div class="bg-primary/[0.125]">',
    })

    expect(await doc.documentColors()).toEqual([
      //
      { range: range(0, 12, 0, 30), color: rgb(1, 0, 0, 0.13) },
    ])
  })

  test('arbitrary value', async () => {
    let doc = await client.open({
      lang: 'html',
      text: '<div class="bg-[red]">',
    })

    expect(await doc.documentColors()).toEqual([
      //
      { range: range(0, 12, 0, 20), color: rgb(1, 0, 0) },
    ])
  })

  test('arbitrary value + opacity modifier', async () => {
    let doc = await client.open({
      lang: 'html',
      text: '<div class="bg-[red]/20">',
    })

    expect(await doc.documentColors()).toEqual([
      //
      { range: range(0, 12, 0, 23), color: rgb(1, 0, 0, 0.2) },
    ])
  })

  test('arbitrary value + arbitrary opacity modifier', async () => {
    let doc = await client.open({
      lang: 'html',
      text: '<div class="bg-[red]/[0.125]">',
    })

    expect(await doc.documentColors()).toEqual([
      //
      { range: range(0, 12, 0, 28), color: rgb(1, 0, 0, 0.13) },
    ])
  })

  test('an opacity modifier of zero is ignored', async () => {
    let doc = await client.open({
      lang: 'html',
      text: '<div class="bg-primary/0 bg-[red]/0 bg-primary/[0] bg-[red]/[0]">',
    })

    expect(await doc.documentColors()).toEqual([])
  })

  test('oklch colors are supported', async () => {
    let doc = await client.open({
      lang: 'html',
      text: '<div class="bg-[oklch(60%_0.25_25)]',
    })

    expect(await doc.documentColors()).toEqual([
      //
      { range: range(0, 12, 0, 35), color: rgb(0.9475942429386454, 0, 0.14005415620741646) },
    ])
  })

  test('gradient colors are supported', async () => {
    let doc = await client.open({
      lang: 'html',
      text: '<div class="from-black from-black/50 via-black via-black/50 to-black to-black/50">',
    })

    expect(await doc.documentColors()).toEqual([
      // from-black from-black/50
      { range: range(0, 12, 0, 22), color: rgb(0, 0, 0) },
      { range: range(0, 23, 0, 36), color: rgb(0, 0, 0, 0.5) },

      // via-black via-black/50
      { range: range(0, 37, 0, 46), color: rgb(0, 0, 0) },
      { range: range(0, 47, 0, 59), color: rgb(0, 0, 0, 0.5) },

      // to-black to-black/50
      { range: range(0, 60, 0, 68), color: rgb(0, 0, 0) },
      { range: range(0, 69, 0, 80), color: rgb(0, 0, 0, 0.5) },
    ])
  })

  test('light-dark() resolves to the light color', async () => {
    let doc = await client.open({
      lang: 'html',
      text: '<div class="bg-light-dark">',
    })

    let colors = await doc.documentColors()

    expect(colors).toEqual([
      //
      { range: range(0, 12, 0, 25), color: rgb(1, 0, 0, 1) },
    ])
  })

  test('colors are recursively resolved from the theme', async () => {
    let client = await createClient({
      config: {
        kind: 'css',
        content: css`
          @theme {
            --color-primary: #ff0000;
            --color-level-1: var(--color-primary);
            --color-level-2: var(--color-level-1);
            --color-level-3: var(--color-level-2);
            --color-level-4: var(--color-level-3);
            --color-level-5: var(--color-level-4);
          }
        `,
      },
    })

    let doc = await client.open({
      lang: 'html',
      text: '<div class="bg-primary bg-level-1 bg-level-2 bg-level-3 bg-level-4 bg-level-5">',
    })

    let colors = await doc.documentColors()

    expect(colors).toEqual([
      { range: range(0, 12, 0, 22), color: rgb(1, 0, 0, 1) },
      { range: range(0, 23, 0, 33), color: rgb(1, 0, 0, 1) },
      { range: range(0, 34, 0, 44), color: rgb(1, 0, 0, 1) },
      { range: range(0, 45, 0, 55), color: rgb(1, 0, 0, 1) },
      { range: range(0, 56, 0, 66), color: rgb(1, 0, 0, 1) },
      { range: range(0, 67, 0, 77), color: rgb(1, 0, 0, 1) },
    ])
  })
})
