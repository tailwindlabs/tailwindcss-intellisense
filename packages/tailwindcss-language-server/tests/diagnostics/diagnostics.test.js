import * as fs from 'node:fs/promises'
import { expect, test } from 'vitest'
import { withFixture } from '../common'
import { css, defineTest } from '../../src/testing'
import { createClient } from '../utils/client'

withFixture('basic', (c) => {
  function testFixture(fixture) {
    test(fixture, async () => {
      fixture = await fs.readFile(`tests/diagnostics/${fixture}.json`, 'utf8')

      let { code, expected, language = 'html' } = JSON.parse(fixture)

      let promise = new Promise((resolve) => {
        c.onNotification('textDocument/publishDiagnostics', ({ diagnostics }) => {
          resolve(diagnostics)
        })
      })

      let doc = await c.openDocument({ text: code, lang: language })
      let diagnostics = await promise

      expected = JSON.parse(JSON.stringify(expected).replaceAll('{{URI}}', doc.uri))

      expect(diagnostics).toEqual(expected)
    })
  }

  testFixture('css-conflict/simple')
  testFixture('css-conflict/variants-negative')
  testFixture('css-conflict/variants-positive')
  testFixture('css-conflict/jsx-concat-negative')
  testFixture('css-conflict/jsx-concat-positive')
  testFixture('css-conflict/css')
  testFixture('css-conflict/css-multi-rule')
  testFixture('css-conflict/css-multi-prop')
  testFixture('css-conflict/vue-style-lang-sass')
  testFixture('invalid-screen/simple')
  testFixture('invalid-theme/simple')
})

withFixture('v4/basic', (c) => {
  function testFixture(fixture) {
    test(fixture, async () => {
      fixture = await fs.readFile(`tests/diagnostics/${fixture}.json`, 'utf8')

      let { code, expected, language = 'html' } = JSON.parse(fixture)

      let promise = new Promise((resolve) => {
        c.onNotification('textDocument/publishDiagnostics', ({ diagnostics }) => {
          resolve(diagnostics)
        })
      })

      let doc = await c.openDocument({ text: code, lang: language })
      let diagnostics = await promise

      expected = JSON.parse(JSON.stringify(expected).replaceAll('{{URI}}', doc.uri))

      expect(diagnostics).toEqual(expected)
    })
  }

  function testInline(fixture, { code, expected, language = 'html' }) {
    test(fixture, async () => {
      let promise = new Promise((resolve) => {
        c.onNotification('textDocument/publishDiagnostics', ({ diagnostics }) => {
          resolve(diagnostics)
        })
      })

      let doc = await c.openDocument({ text: code, lang: language })
      let diagnostics = await promise

      expected = JSON.parse(JSON.stringify(expected).replaceAll('{{URI}}', doc.uri))

      expect(diagnostics).toEqual(expected)
    })
  }

  testFixture('css-conflict/simple')
  testFixture('css-conflict/variants-negative')
  testFixture('css-conflict/variants-positive')
  testFixture('css-conflict/jsx-concat-negative')
  testFixture('css-conflict/jsx-concat-positive')
  testFixture('css-conflict/vue-style-lang-sass')
  // testFixture('css-conflict/css')
  // testFixture('css-conflict/css-multi-rule')
  // testFixture('css-conflict/css-multi-prop')
  // testFixture('invalid-screen/simple')

  testInline('simple typos in theme keys (in key)', {
    code: '.test { color: theme(--color-red-901) }',
    language: 'css',
    expected: [
      {
        code: 'invalidConfigPath',
        range: { start: { line: 0, character: 21 }, end: { line: 0, character: 36 } },
        severity: 1,
        message: "'--color-red-901' does not exist in your theme. Did you mean '--color-red-900'?",
        suggestions: ['--color-red-900'],
      },
    ],
  })

  testInline('simple typos in theme keys (in namespace)', {
    code: '.test { color: theme(--colors-red-901) }',
    language: 'css',
    expected: [
      {
        code: 'invalidConfigPath',
        range: { start: { line: 0, character: 21 }, end: { line: 0, character: 37 } },
        severity: 1,
        message: "'--colors-red-901' does not exist in your theme. Did you mean '--color-red-900'?",
        suggestions: ['--color-red-900'],
      },
    ],
  })

  testInline('No similar theme key exists', {
    code: '.test { color: theme(--font-obliqueness-90) }',
    language: 'css',
    expected: [
      {
        code: 'invalidConfigPath',
        range: { start: { line: 0, character: 21 }, end: { line: 0, character: 42 } },
        severity: 1,
        message: "'--font-obliqueness-90' does not exist in your theme.",
        suggestions: [],
      },
    ],
  })

  testInline('valid theme keys dont issue diagnostics', {
    code: '.test { color: theme(--color-red-900) }',
    language: 'css',
    expected: [],
  })

  testInline('types in legacy theme config paths', {
    code: '.test { color: theme(colors.red.901) }',
    language: 'css',
    expected: [
      {
        code: 'invalidConfigPath',
        range: { start: { line: 0, character: 21 }, end: { line: 0, character: 35 } },
        severity: 1,
        message: "'colors.red.901' does not exist in your theme config.",
        suggestions: [],
      },
    ],
  })

  testInline('valid legacy theme config paths', {
    code: '.test { color: theme(colors.red.900) }',
    language: 'css',
    expected: [],
  })
})

withFixture('v4/with-prefix', (c) => {
  function testInline(fixture, { code, expected, language = 'html' }) {
    test(fixture, async () => {
      let promise = new Promise((resolve) => {
        c.onNotification('textDocument/publishDiagnostics', ({ diagnostics }) => {
          resolve(diagnostics)
        })
      })

      let doc = await c.openDocument({ text: code, lang: language })
      let diagnostics = await promise

      expected = JSON.parse(JSON.stringify(expected).replaceAll('{{URI}}', doc.uri))

      expect(diagnostics).toEqual(expected)
    })
  }

  // testFixture('css-conflict/simple')
  // testFixture('css-conflict/variants-negative')
  // testFixture('css-conflict/variants-positive')
  // testFixture('css-conflict/jsx-concat-negative')
  // testFixture('css-conflict/jsx-concat-positive')
  // testFixture('css-conflict/vue-style-lang-sass')

  // testFixture('css-conflict/css')
  // testFixture('css-conflict/css-multi-rule')
  // testFixture('css-conflict/css-multi-prop')
  // testFixture('invalid-screen/simple')

  testInline('simple typos in theme keys (in key)', {
    code: '.test { color: theme(--color-red-901) }',
    language: 'css',
    expected: [
      {
        code: 'invalidConfigPath',
        range: { start: { line: 0, character: 21 }, end: { line: 0, character: 36 } },
        severity: 1,
        message: "'--color-red-901' does not exist in your theme. Did you mean '--color-red-900'?",
        suggestions: ['--color-red-900'],
      },
    ],
  })

  testInline('simple typos in theme keys (in namespace)', {
    code: '.test { color: theme(--colors-red-901) }',
    language: 'css',
    expected: [
      {
        code: 'invalidConfigPath',
        range: { start: { line: 0, character: 21 }, end: { line: 0, character: 37 } },
        severity: 1,
        message: "'--colors-red-901' does not exist in your theme. Did you mean '--color-red-900'?",
        suggestions: ['--color-red-900'],
      },
    ],
  })

  testInline('No similar theme key exists', {
    code: '.test { color: theme(--font-obliqueness-90) }',
    language: 'css',
    expected: [
      {
        code: 'invalidConfigPath',
        range: { start: { line: 0, character: 21 }, end: { line: 0, character: 42 } },
        severity: 1,
        message: "'--font-obliqueness-90' does not exist in your theme.",
        suggestions: [],
      },
    ],
  })

  testInline('valid theme keys dont issue diagnostics', {
    code: '.test { color: theme(--color-red-900) }',
    language: 'css',
    expected: [],
  })

  testInline('types in legacy theme config paths', {
    code: '.test { color: theme(colors.red.901) }',
    language: 'css',
    expected: [
      {
        code: 'invalidConfigPath',
        range: { start: { line: 0, character: 21 }, end: { line: 0, character: 35 } },
        severity: 1,
        message: "'colors.red.901' does not exist in your theme config.",
        suggestions: [],
      },
    ],
  })

  testInline('valid legacy theme config paths', {
    code: '.test { color: theme(colors.red.900) }',
    language: 'css',
    expected: [],
  })
})

withFixture('v4/basic', (c) => {
  function testMatch(name, { code, expected, language = 'html' }) {
    test(name, async () => {
      let promise = new Promise((resolve) => {
        c.onNotification('textDocument/publishDiagnostics', ({ diagnostics }) => {
          resolve(diagnostics)
        })
      })

      let doc = await c.openDocument({ text: code, lang: language })
      let diagnostics = await promise

      expected = JSON.parse(JSON.stringify(expected).replaceAll('{{URI}}', doc.uri))

      expect(diagnostics).toMatchObject(expected)
    })
  }

  testMatch('conflicts show even when unknown classes are present', {
    code: `<div class="foo max-w-4xl max-w-6xl hover:underline">testing</div>`,
    expected: [
      {
        code: 'cssConflict',
        message: "'max-w-4xl' applies the same CSS properties as 'max-w-6xl'.",
        className: {
          className: 'max-w-4xl',
          classList: {
            classList: 'foo max-w-4xl max-w-6xl hover:underline',
          },
        },
        otherClassNames: [
          {
            className: 'max-w-6xl',
            classList: {
              classList: 'foo max-w-4xl max-w-6xl hover:underline',
            },
          },
        ],
      },
      {
        code: 'cssConflict',
        message: "'max-w-6xl' applies the same CSS properties as 'max-w-4xl'.",
        className: {
          className: 'max-w-6xl',
          classList: {
            classList: 'foo max-w-4xl max-w-6xl hover:underline',
          },
        },
        otherClassNames: [
          {
            className: 'max-w-4xl',
            classList: {
              classList: 'foo max-w-4xl max-w-6xl hover:underline',
            },
          },
        ],
      },
    ],
  })

  testMatch('Old Tailwind directives warn when used in a v4 project', {
    language: 'css',
    code: `
      @tailwind base;
      @tailwind preflight;
      @tailwind components;
      @tailwind screens;
      @tailwind variants;
    `,
    expected: [
      {
        code: 'invalidTailwindDirective',
        message:
          "'@tailwind base' is no longer available in v4. Use '@import \"tailwindcss/preflight\"' instead.",
        suggestions: [],
        range: {
          start: { line: 1, character: 16 },
          end: { line: 1, character: 20 },
        },
        severity: 1,
      },
      {
        code: 'invalidTailwindDirective',
        message:
          "'@tailwind preflight' is no longer available in v4. Use '@import \"tailwindcss/preflight\"' instead.",
        suggestions: [],
        range: {
          start: { line: 2, character: 16 },
          end: { line: 2, character: 25 },
        },
        severity: 1,
      },
      {
        code: 'invalidTailwindDirective',
        message:
          "'@tailwind components' is no longer available in v4. Use '@tailwind utilities' instead.",
        suggestions: ['utilities'],
        range: {
          start: { line: 3, character: 16 },
          end: { line: 3, character: 26 },
        },
        severity: 1,
      },
      {
        code: 'invalidTailwindDirective',
        message:
          "'@tailwind screens' is no longer available in v4. Use '@tailwind utilities' instead.",
        suggestions: ['utilities'],
        range: {
          start: { line: 4, character: 16 },
          end: { line: 4, character: 23 },
        },
        severity: 1,
      },
      {
        code: 'invalidTailwindDirective',
        message:
          "'@tailwind variants' is no longer available in v4. Use '@tailwind utilities' instead.",
        suggestions: ['utilities'],
        range: {
          start: { line: 5, character: 16 },
          end: { line: 5, character: 24 },
        },
        severity: 1,
      },
    ],
  })
})

defineTest({
  name: 'Shows warning when using blocklisted classes',
  fs: {
    'app.css': css`
      @import 'tailwindcss';
      @source not inline("{,hover:}flex");
    `,
  },
  prepare: async ({ root }) => ({ client: await createClient({ root }) }),
  handle: async ({ client }) => {
    let doc = await client.open({
      lang: 'html',
      text: '<div class="flex underline hover:flex">',
    })

    let diagnostics = await doc.diagnostics()

    expect(diagnostics).toEqual([
      {
        code: 'usedBlocklistedClass',
        message: 'The class "flex" will not be generated as it has been blocklisted',
        range: {
          start: { line: 0, character: 12 },
          end: { line: 0, character: 16 },
        },
        severity: 2,
      },
      {
        code: 'usedBlocklistedClass',
        message: 'The class "hover:flex" will not be generated as it has been blocklisted',
        range: {
          start: { line: 0, character: 27 },
          end: { line: 0, character: 37 },
        },
        severity: 2,
      },
    ])
  },
})
