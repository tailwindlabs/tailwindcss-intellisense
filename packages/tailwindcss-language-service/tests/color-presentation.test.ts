import { describe, expect, test } from 'vitest'
import { createClient } from './utils/client'
import { html, rgb, css, range } from './utils/utils'

describe('v4', async () => {
  let client = await createClient({
    config: {
      kind: 'css',
      content: css`
        @theme {
          --color-black: #000;
        }
      `,
    },
  })

  test('color keyword', async () => {
    let doc = await client.open({
      lang: 'html',
      text: html`<div class="bg-[red]"></div>`,
    })

    let presentation = await doc.colorPresentation(rgb(1, 0, 0), range(0, 12, 0, 20))

    expect(presentation).toEqual([
      { label: 'bg-[#ff0000]' },
      { label: 'bg-[rgb(255,0,0)]' },
      { label: 'bg-[hsl(0,100%,50%)]' },
    ])
  })

  test('short hex', async () => {
    let doc = await client.open({
      lang: 'html',
      text: html`<div class="bg-[#f00]"></div>`,
    })

    let presentation = await doc.colorPresentation(rgb(1, 0, 0), range(0, 12, 0, 21))

    expect(presentation).toEqual([
      { label: 'bg-[#f00]' },
      { label: 'bg-[rgb(255,0,0)]' },
      { label: 'bg-[hsl(0,100%,50%)]' },
    ])
  })

  test('long hex', async () => {
    let doc = await client.open({
      lang: 'html',
      text: html`<div class="bg-[#ff0000]"></div>`,
    })

    let presentation = await doc.colorPresentation(rgb(1, 0, 0), range(0, 12, 0, 24))

    expect(presentation).toEqual([
      { label: 'bg-[#ff0000]' },
      { label: 'bg-[rgb(255,0,0)]' },
      { label: 'bg-[hsl(0,100%,50%)]' },
    ])
  })

  test('rgb', async () => {
    let doc = await client.open({
      lang: 'html',
      text: html`<div class="bg-[rgb(255,0,0)]"></div>`,
    })

    let presentation = await doc.colorPresentation(rgb(1, 0, 0), range(0, 12, 0, 29))

    expect(presentation).toEqual([
      { label: 'bg-[#ff0000]' },
      { label: 'bg-[rgb(255,0,0)]' },
      { label: 'bg-[hsl(0,100%,50%)]' },
    ])
  })

  test('hsl', async () => {
    let doc = await client.open({
      lang: 'html',
      text: html`<div class="bg-[hsl(0,100%,50%)]"></div>`,
    })

    let presentation = await doc.colorPresentation(rgb(1, 0, 0), range(0, 12, 0, 32))

    expect(presentation).toEqual([
      { label: 'bg-[#ff0000]' },
      { label: 'bg-[rgb(255,0,0)]' },
      { label: 'bg-[hsl(0,100%,50%)]' },
    ])
  })

  test('oklch colors are ignored', async () => {
    let doc = await client.open({
      lang: 'html',
      text: html`<div class="bg-[oklch(44.05%_0.16_303)]"></div>`,
    })

    let presentation = await doc.colorPresentation(rgb(1, 0, 0), range(0, 12, 0, 39))

    expect(presentation).toEqual([])
  })

  test('named color utilities are ignored', async () => {
    let doc = await client.open({
      lang: 'html',
      text: html`<div class="bg-black"></div>`,
    })

    let presentation = await doc.colorPresentation(rgb(0, 0, 0), range(0, 12, 0, 20))

    expect(presentation).toEqual([])
  })
})
