import dedent from 'dedent'
import { test } from 'vitest'
import { scanHtml } from './scan'

test('parses HTML', async ({ expect }) => {
  let input = dedent`
    <div class="example">
      <script>
        console.log('Hello, world!')
      </script>
    </div>
  `

  let scope = scanHtml({
    input,
    offset: 0,
    classAttributes: [],
  })

  expect(scope).toEqual({
    kind: 'context',
    source: {
      scope: [0, 84],
    },
    meta: {
      lang: 'html',
      syntax: 'html',
    },
    children: [
      {
        kind: 'context',
        source: {
          scope: [32, 68],
        },
        meta: {
          lang: 'js',
          syntax: 'js',
        },
        children: [],
      },
    ],
  })
})

test('Identifies HTML comments', async ({ expect }) => {
  let input = dedent`
    <div class="example">
      <!--
        <span></span>
      -->
    </div>
  `

  let scope = scanHtml({
    input,
    offset: 0,
    classAttributes: [],
  })

  expect(scope).toEqual({
    children: [
      {
        kind: 'comment',
        source: { scope: [24, 52] },
        children: [],
      },
    ],
    kind: 'context',
    meta: {
      lang: 'html',
      syntax: 'html',
    },
    source: {
      scope: [0, 59],
    },
  })
})

test('Identifies class attributes', async ({ expect }) => {
  let input = dedent`
    <div class="flex">
      <span :class="flex-1"></span>
      <span [class]="flex-2"></span>
      <span :[class]="flex-3"></span>
      <span className="flex-4"></span>
      <span
        className={clsx(
          'flex-5',
          { 'flex-6': true },
          { 'flex-7': false },
        )}
      ></span>
    </div>
  `

  let scope = scanHtml({
    input,
    offset: 0,
    classAttributes: ['class', 'className'],
  })

  expect(scope).toEqual({
    kind: 'context',
    source: {
      scope: [0, 275],
    },
    meta: {
      lang: 'html',
      syntax: 'html',
    },
    children: [
      {
        kind: 'class.attr',
        meta: { static: true },
        source: { scope: [12, 16] },
        children: [],
      },
      {
        kind: 'class.attr',
        meta: { static: false },
        source: { scope: [35, 41] },
        children: [],
      },
      {
        kind: 'class.attr',
        meta: { static: false },
        source: { scope: [68, 74] },
        children: [],
      },
      {
        kind: 'class.attr',
        meta: { static: false },
        source: { scope: [102, 108] },
        children: [],
      },
      {
        kind: 'class.attr',
        meta: { static: true },
        source: { scope: [137, 143] },
        children: [],
      },
      {
        kind: 'class.attr',
        meta: { static: false },
        source: { scope: [176, 256] },
        children: [],
      },
    ],
  })
})

test('quotes ignore element detection', async ({ expect }) => {
  let input = dedent`
    <div class="flex">
      <span class="<script></script>"></span>
    </div>
  `

  let scope = scanHtml({
    input,
    offset: 0,
    classAttributes: ['class', 'className'],
  })

  expect(scope).toEqual({
    kind: 'context',
    source: {
      scope: [0, 67],
    },
    meta: {
      lang: 'html',
      syntax: 'html',
    },
    children: [
      {
        kind: 'class.attr',
        meta: { static: true },
        source: { scope: [12, 16] },
        children: [],
      },
      {
        kind: 'class.attr',
        meta: { static: true },
        source: { scope: [34, 51] },
        children: [],
      },
    ],
  })
})
