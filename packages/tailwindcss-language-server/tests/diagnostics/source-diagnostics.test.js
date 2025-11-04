import { expect, test } from 'vitest'
import { withFixture } from '../common'

withFixture('v4/basic', (c) => {
  function runTest(name, { code, expected, language }) {
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

  runTest('Source directives require paths', {
    language: 'css',
    code: `
      @import 'tailwindcss' source();
      @import 'tailwindcss' source('');
      @import 'tailwindcss' source("");
      @tailwind utilities source();
      @tailwind utilities source('');
      @tailwind utilities source("");
    `,
    expected: [
      {
        code: 'invalidSourceDirective',
        source: 'tailwindcss',
        message: 'The source directive requires a path to a directory.',
        range: {
          start: { line: 1, character: 35 },
          end: { line: 1, character: 35 },
        },
      },
      {
        code: 'invalidSourceDirective',
        source: 'tailwindcss',
        message: 'The source directive requires a path to a directory.',
        range: {
          start: { line: 2, character: 35 },
          end: { line: 2, character: 37 },
        },
      },
      {
        code: 'invalidSourceDirective',
        source: 'tailwindcss',
        message: 'The source directive requires a path to a directory.',
        range: {
          start: { line: 3, character: 35 },
          end: { line: 3, character: 37 },
        },
      },
      {
        code: 'invalidSourceDirective',
        source: 'tailwindcss',
        message: 'The source directive requires a path to a directory.',
        range: {
          start: { line: 4, character: 33 },
          end: { line: 4, character: 33 },
        },
      },
      {
        code: 'invalidSourceDirective',
        source: 'tailwindcss',
        message: 'The source directive requires a path to a directory.',
        range: {
          start: { line: 5, character: 33 },
          end: { line: 5, character: 35 },
        },
      },
      {
        code: 'invalidSourceDirective',
        source: 'tailwindcss',
        message: 'The source directive requires a path to a directory.',
        range: {
          start: { line: 6, character: 33 },
          end: { line: 6, character: 35 },
        },
      },
    ],
  })

  runTest('source(none) must not be misspelled', {
    language: 'css',
    code: `
      @import 'tailwindcss' source(no);
      @tailwind utilities source(no);
    `,
    expected: [
      {
        code: 'invalidSourceDirective',
        source: 'tailwindcss',
        message: '`source(no)` is invalid. Did you mean `source(none)`?',
        range: {
          start: { line: 1, character: 35 },
          end: { line: 1, character: 37 },
        },
      },
      {
        code: 'invalidSourceDirective',
        source: 'tailwindcss',
        message: '`source(no)` is invalid. Did you mean `source(none)`?',
        range: {
          start: { line: 2, character: 33 },
          end: { line: 2, character: 35 },
        },
      },
    ],
  })

  runTest('source("…") does not produce diagnostics', {
    language: 'css',
    code: `
      @import 'tailwindcss' source('../app');
      @tailwind utilities source('../app');
      @import 'tailwindcss' source("../app");
      @tailwind utilities source("../app");
    `,
    expected: [],
  })

  runTest('paths given to source("…") must error when not POSIX', {
    language: 'css',
    code: String.raw`
      @import 'tailwindcss' source('C:\\absolute\\path');
      @import 'tailwindcss' source('C:relative.txt');
    `,
    expected: [
      {
        code: 'invalidSourceDirective',
        source: 'tailwindcss',
        message:
          'POSIX-style paths are required with `source(…)` but `C:\\absolute\\path` is a Windows-style path.',
        range: {
          start: { line: 1, character: 35 },
          end: { line: 1, character: 55 },
        },
      },
      {
        code: 'invalidSourceDirective',
        source: 'tailwindcss',
        message:
          'POSIX-style paths are required with `source(…)` but `C:relative.txt` is a Windows-style path.',
        range: {
          start: { line: 2, character: 35 },
          end: { line: 2, character: 51 },
        },
      },
    ],
  })
})
