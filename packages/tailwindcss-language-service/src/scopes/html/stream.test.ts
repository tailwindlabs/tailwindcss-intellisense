import dedent from 'dedent'
import { test } from 'vitest'
import { createHtmlStream } from './stream'

function extract(input: string) {
  return Array.from(createHtmlStream({ input, offset: 0 }), (event) => ({
    ...event,
    slice: input.slice(...event.span),
  }))
}

test('parses HTML', async ({ expect }) => {
  let input = dedent`
    <div class="example">
      <span></span>
    </div>
  `

  expect(extract(input)).toEqual([
    {
      kind: 'element-start',
      span: [0, 4],
      slice: '<div',
    },
    {
      kind: 'attr-name',
      span: [5, 10],
      slice: 'class',
    },
    {
      kind: 'attr-value',
      span: [12, 19],
      slice: 'example',
    },
    {
      kind: 'element-end',
      span: [20, 21],
      slice: '>',
    },
    {
      kind: 'element-start',
      span: [24, 29],
      slice: '<span',
    },
    {
      kind: 'element-end',
      span: [29, 30],
      slice: '>',
    },
    {
      kind: 'element-start',
      span: [30, 36],
      slice: '</span',
    },
    {
      kind: 'element-end',
      span: [36, 37],
      slice: '>',
    },
    {
      kind: 'element-start',
      span: [38, 43],
      slice: '</div',
    },
    {
      kind: 'element-end',
      span: [43, 44],
      slice: '>',
    },
  ])
})

test('Identifies HTML comments', async ({ expect }) => {
  let input = dedent`
    <div class="example">
      <!--
        <span></span>
      -->
    </div>
  `

  expect(extract(input)).toEqual([
    {
      kind: 'element-start',
      span: [0, 4],
      slice: '<div',
    },
    {
      kind: 'attr-name',
      span: [5, 10],
      slice: 'class',
    },
    {
      kind: 'attr-value',
      span: [12, 19],
      slice: 'example',
    },
    {
      kind: 'element-end',
      span: [20, 21],
      slice: '>',
    },
    {
      kind: 'comment-start',
      span: [24, 28],
      slice: '<!--',
    },
    {
      kind: 'comment-end',
      span: [49, 52],
      slice: '-->',
    },
    {
      kind: 'element-start',
      span: [53, 58],
      slice: '</div',
    },
    {
      kind: 'element-end',
      span: [58, 59],
      slice: '>',
    },
  ])
})

test('lots of attributes', async ({ expect }) => {
  let input = dedent`
    <div class="flex">
      <span :class="flex-1"></span>
      <span [class]="flex-2"></span>
      <span :[class]="flex-3"></span>
    </div>
  `

  expect(extract(input)).toMatchInlineSnapshot([
    {
      kind: 'element-start',
      slice: '<div',
      span: [0, 4],
    },
    {
      kind: 'attr-name',
      slice: 'class',
      span: [5, 10],
    },
    {
      kind: 'attr-value',
      slice: 'flex',
      span: [12, 16],
    },
    {
      kind: 'element-end',
      slice: '>',
      span: [17, 18],
    },
    {
      kind: 'element-start',
      slice: '<span',
      span: [21, 26],
    },
    {
      kind: 'attr-name',
      slice: ':class',
      span: [27, 33],
    },
    {
      kind: 'attr-value',
      slice: 'flex-1',
      span: [35, 41],
    },
    {
      kind: 'element-end',
      slice: '>',
      span: [42, 43],
    },
    {
      kind: 'element-start',
      slice: '<span',
      span: [53, 58],
    },
    {
      kind: 'attr-name',
      slice: '[class]',
      span: [59, 66],
    },
    {
      kind: 'attr-value',
      slice: 'flex-2',
      span: [68, 74],
    },
    {
      kind: 'element-end',
      slice: '>',
      span: [75, 76],
    },
    {
      kind: 'element-start',
      slice: '<span',
      span: [86, 91],
    },
    {
      kind: 'attr-name',
      slice: ':[class]',
      span: [92, 100],
    },
    {
      kind: 'attr-value',
      slice: 'flex-3',
      span: [102, 108],
    },
    {
      kind: 'element-end',
      slice: '>',
      span: [109, 110],
    },
    {
      kind: 'element-start',
      slice: '</div',
      span: [118, 123],
    },
    {
      kind: 'element-end',
      slice: '>',
      span: [123, 124],
    },
  ])
})
