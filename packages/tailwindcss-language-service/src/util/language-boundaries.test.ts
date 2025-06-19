import { test } from 'vitest'
import { getLanguageBoundaries } from './getLanguageBoundaries'
import { jsx, createDocument, html, astro } from './test-utils'

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
      range: {
        start: { line: 0, character: 0 },
        end: { line: 1, character: 2 },
      },
    },
    {
      type: 'css',
      range: {
        start: { line: 1, character: 2 },
        end: { line: 5, character: 2 },
      },
    },
    {
      type: 'html',
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
      range: {
        start: { line: 0, character: 0 },
        end: { line: 1, character: 2 },
      },
    },
    {
      type: 'js',
      range: {
        start: { line: 1, character: 2 },
        end: { line: 5, character: 2 },
      },
    },
    {
      type: 'html',
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
      range: {
        start: { line: 0, character: 0 },
        end: { line: 0, character: 0 },
      },
    },
    {
      type: 'js',
      range: {
        start: { line: 0, character: 0 },
        end: { line: 2, character: 0 },
      },
    },
    {
      type: 'none',
      range: {
        start: { line: 2, character: 0 },
        end: { line: 3, character: 0 },
      },
    },
    {
      type: 'html',
      range: {
        start: { line: 3, character: 0 },
        end: { line: 5, character: 0 },
      },
    },
    {
      type: 'none',
      range: {
        start: { line: 5, character: 0 },
        end: { line: 6, character: 0 },
      },
    },
    {
      type: 'css',
      range: {
        start: { line: 6, character: 0 },
        end: { line: 10, character: 0 },
      },
    },
    {
      type: 'none',
      range: {
        start: { line: 10, character: 0 },
        end: { line: 13, character: 16 },
      },
    },
  ])
})

test('Astro files default to HTML', ({ expect }) => {
  let file = createDocument({
    name: 'file.astro',
    lang: 'astro',
    content: html`<div class="border-gray-200"></div>`,
  })

  let boundaries = getLanguageBoundaries(file.state, file.doc)

  expect(boundaries).toEqual([
    {
      type: 'html',
      range: {
        start: { line: 0, character: 0 },
        end: { line: 0, character: 35 },
      },
    },
  ])
})

test('Astro files front matter is parsed as JS', ({ expect }) => {
  let file = createDocument({
    name: 'file.astro',
    lang: 'astro',
    content: astro`
      ---
      console.log('test')
      ---
      <div class="border-gray-200"></div>
    `,
  })

  let boundaries = getLanguageBoundaries(file.state, file.doc)

  expect(boundaries).toEqual([
    // This block just shouldn't be here
    {
      type: 'html',
      range: {
        start: { line: 0, character: 0 },
        end: { line: 0, character: 0 },
      },
    },
    {
      type: 'js',
      range: {
        // This should probably be 0:3 instead of 0:0
        start: { line: 0, character: 0 },

        // This should probably be 2:0 instead of 1:19
        end: { line: 1, character: 19 },
      },
    },
    {
      type: 'html',
      range: {
        // This should probably be 2:3 instead of 1:19
        start: { line: 1, character: 19 },
        end: { line: 3, character: 35 },
      },
    },
  ])
})
