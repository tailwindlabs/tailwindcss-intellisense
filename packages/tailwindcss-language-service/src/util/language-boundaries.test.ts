import { test } from 'vitest'
import { getLanguageBoundaries } from './getLanguageBoundaries'
import { jsx, createDocument, html } from './test-utils'

test('regex literals are ignored when determining language boundaries', ({ expect }) => {
  let file = createDocument({
    name: 'file.js',
    lang: 'javascript',
    content: jsx`
      export default function Page() {
        let styles = "str".match(/<style>[\s\S]*?<\/style>/m)
        return <div className="border-gray-200">{styles}</div>
      }
    `,
  })

  let boundaries = getLanguageBoundaries(file.state, file.doc)

  expect(boundaries).toEqual([
    {
      type: 'jsx',
      span: [0, 147],
      range: {
        start: { line: 0, character: 0 },
        end: { line: 3, character: 1 },
      },
    },
  ])
})

test('style tags in HTML are treated as a separate boundary', ({ expect }) => {
  let file = createDocument({
    name: 'file.html',
    lang: 'html',
    content: html`
      <div>
        <style>
          body {
            background-color: red;
          }
        </style>
        <div class="border-gray-200"></div>
      </div>
    `,
  })

  let boundaries = getLanguageBoundaries(file.state, file.doc)

  expect(boundaries).toEqual([
    {
      type: 'html',
      span: [0, 8],
      range: {
        start: { line: 0, character: 0 },
        end: { line: 1, character: 2 },
      },
    },
    {
      type: 'css',
      span: [8, 64],
      range: {
        start: { line: 1, character: 2 },
        end: { line: 5, character: 2 },
      },
    },
    {
      type: 'html',
      span: [64, 117],
      range: {
        start: { line: 5, character: 2 },
        end: { line: 7, character: 6 },
      },
    },
  ])
})

test('script tags in HTML are treated as a separate boundary', ({ expect }) => {
  let file = createDocument({
    name: 'file.html',
    lang: 'html',
    content: html`
      <div>
        <script>
          let a = '1'
          let b = '2'
          let c = '3'
        </script>
        <div class="border-gray-200"></div>
      </div>
    `,
  })

  let boundaries = getLanguageBoundaries(file.state, file.doc)

  expect(boundaries).toEqual([
    {
      type: 'html',
      span: [0, 8],
      range: {
        start: { line: 0, character: 0 },
        end: { line: 1, character: 2 },
      },
    },
    {
      type: 'js',
      span: [8, 67],
      range: {
        start: { line: 1, character: 2 },
        end: { line: 5, character: 2 },
      },
    },
    {
      type: 'html',
      span: [67, 121],
      range: {
        start: { line: 5, character: 2 },
        end: { line: 7, character: 6 },
      },
    },
  ])
})

test('Vue files detect <template>, <script>, and <style> as separate boundaries', ({ expect }) => {
  let file = createDocument({
    name: 'file.vue',
    lang: 'vue',
    content: html`
      <script setup>
        let a = '1'
      </script>
      <template>
        <div class="border-gray-200"></div>
      </template>
      <style>
        body {
          background-color: red;
        }
      </style>
      <documentation>
        <div>Some documentation</div>
      </documentation>
    `,
  })

  let boundaries = getLanguageBoundaries(file.state, file.doc)

  expect(boundaries).toEqual([
    {
      type: 'none',
      span: [0, 0],
      range: {
        start: { line: 0, character: 0 },
        end: { line: 0, character: 0 },
      },
    },
    {
      type: 'js',
      span: [0, 29],
      range: {
        start: { line: 0, character: 0 },
        end: { line: 2, character: 0 },
      },
    },
    {
      type: 'none',
      span: [29, 39],
      range: {
        start: { line: 2, character: 0 },
        end: { line: 3, character: 0 },
      },
    },
    {
      type: 'html',
      span: [39, 88],
      range: {
        start: { line: 3, character: 0 },
        end: { line: 5, character: 0 },
      },
    },
    {
      type: 'none',
      span: [88, 100],
      range: {
        start: { line: 5, character: 0 },
        end: { line: 6, character: 0 },
      },
    },
    {
      type: 'css',
      span: [100, 148],
      range: {
        start: { line: 6, character: 0 },
        end: { line: 10, character: 0 },
      },
    },
    {
      type: 'none',
      span: [148, 221],
      range: {
        start: { line: 10, character: 0 },
        end: { line: 13, character: 16 },
      },
    },
  ])
})
