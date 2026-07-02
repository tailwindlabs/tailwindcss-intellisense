import { expect, test } from 'vitest'
import { extractCustomClassesFromCss } from './css-class-scanner'

test('extract custom CSS classes from CSS content', async ({ expect }) => {
  const css = `
    .typography-h3 {
      font-family: Montserrat;
      font-size: 48px;
      font-style: normal;
      font-weight: 700;
      line-height: 116.7%;
    }

    .custom-button {
      background-color: #1a9dd9;
      color: white;
      padding: 0.5rem 1rem;
      border-radius: 0.25rem;
    }

    /* This should be ignored as it's a Tailwind utility */
    .text-blue-500 {
      color: #3b82f6;
    }

    /* This should be ignored as it has pseudo-selectors */
    .hover\:bg-blue-500:hover {
      background-color: #3b82f6;
    }
  `

  const classes = extractCustomClassesFromCss(css, 'test.css')

  expect(classes).toHaveLength(2)
  expect(classes[0]).toEqual({
    className: 'typography-h3',
    source: 'test.css',
    declarations: {
      'font-family': 'Montserrat',
      'font-size': '48px',
      'font-style': 'normal',
      'font-weight': '700',
      'line-height': '116.7%',
    },
  })
  expect(classes[1]).toEqual({
    className: 'custom-button',
    source: 'test.css',
    declarations: {
      'background-color': '#1a9dd9',
      color: 'white',
      padding: '0.5rem 1rem',
      'border-radius': '0.25rem',
    },
  })
})

test('ignore Tailwind utility classes', async ({ expect }) => {
  const css = `
    .text-blue-500 {
      color: #3b82f6;
    }

    .bg-red-500 {
      background-color: #ef4444;
    }

    .p-4 {
      padding: 1rem;
    }
  `

  const classes = extractCustomClassesFromCss(css, 'test.css')

  expect(classes).toHaveLength(0)
})

test('ignore complex selectors', async ({ expect }) => {
  const css = `
    .button:hover {
      background-color: #1a9dd9;
    }

    .input[type="text"] {
      border: 1px solid #ccc;
    }

    .nav > li {
      display: inline-block;
    }
  `

  const classes = extractCustomClassesFromCss(css, 'test.css')

  expect(classes).toHaveLength(0)
})
