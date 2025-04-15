import { test, expect, describe } from 'vitest'
import { ClientOptions, createClient } from './utils/client'
import { css, html, js, range } from './utils/utils'
import { AugmentedDiagnostic } from '../src'
import { DiagnosticKind } from '../src/diagnostics/types'

interface DiagnosticFixture {
  name: string
  client?: ClientOptions
  lang?: string
  text: string
  expected: AugmentedDiagnostic[]
}

describe('v4', async () => {
  let client = await createClient({
    config: {
      kind: 'css',
      content: css`
        @theme {
          --color-red-900: #f00;
          --breakpoint-sm: 40rem;
        }
      `,
    },
  })

  function runTest({ client: clientOpts, name, lang = 'html', text, expected }: DiagnosticFixture) {
    test(name, async () => {
      let testClient = clientOpts ? await createClient(clientOpts) : client
      let doc = await testClient.open({ lang, text })
      expect(await doc.diagnostics()).toEqual({
        kind: 'full',
        items: expected,
      })
    })
  }

  runTest({
    name: 'simple typos in theme keys (in key)',
    lang: 'css',
    text: css`
      .test {
        color: theme(--color-red-901);
      }
    `,
    expected: [
      {
        code: DiagnosticKind.InvalidConfigPath,
        range: range(1, 15, 1, 30),
        severity: 1,
        message: "'--color-red-901' does not exist in your theme. Did you mean '--color-red-900'?",
        suggestions: ['--color-red-900'],
      },
    ],
  })

  runTest({
    name: 'simple typos in theme keys (in namespace)',
    lang: 'css',
    text: css`
      .test {
        color: theme(--colors-red-900);
      }
    `,
    expected: [
      {
        code: DiagnosticKind.InvalidConfigPath,
        range: range(1, 15, 1, 31),
        severity: 1,
        message: "'--colors-red-900' does not exist in your theme. Did you mean '--color-red-900'?",
        suggestions: ['--color-red-900'],
      },
    ],
  })

  runTest({
    name: 'unknown theme key',
    lang: 'css',
    text: css`
      .test {
        color: theme(--font-obliqueness-90);
      }
    `,
    expected: [
      {
        code: DiagnosticKind.InvalidConfigPath,
        range: range(1, 15, 1, 36),
        severity: 1,
        message: "'--font-obliqueness-90' does not exist in your theme.",
        suggestions: [],
      },
    ],
  })

  runTest({
    name: 'valid theme keys dont produce diagnostics',
    lang: 'css',
    text: css`
      .test {
        color: theme(--color-red-900);
      }
    `,
    expected: [],
  })

  runTest({
    name: 'typos in legacy theme config paths',
    lang: 'css',
    text: css`
      .test {
        color: theme(colors.red.901);
      }
    `,
    expected: [
      {
        code: DiagnosticKind.InvalidConfigPath,
        range: range(1, 15, 1, 29),
        severity: 1,
        message: "'colors.red.901' does not exist in your theme config.",
        suggestions: [],
      },
    ],
  })

  runTest({
    name: 'valid legacy theme keys dont issue diagnostics',
    lang: 'css',
    text: css`
      .test {
        color: theme(colors.red.900);
      }
    `,
    expected: [],
  })

  runTest({
    name: 'shows warning when using blocklisted classes',

    client: {
      config: {
        kind: 'css',
        content: css`
          @source not inline("{,hover:}flex");
        `,
      },
    },

    lang: 'html',
    text: html`<div class="flex underline hover:flex"></div>`,
    expected: [
      {
        code: DiagnosticKind.UsedBlocklistedClass,
        range: range(0, 12, 0, 16),
        severity: 2,
        message: 'The class "flex" will not be generated as it has been blocklisted',
      },
      {
        code: DiagnosticKind.UsedBlocklistedClass,
        range: range(0, 27, 0, 37),
        severity: 2,
        message: 'The class "hover:flex" will not be generated as it has been blocklisted',
      },
    ],
  })

  runTest({
    name: 'conflicts show even when unknown classes are present',
    lang: 'html',
    text: html`<div class="foo flex block hover:underline">testing</div>`,
    expected: [
      {
        code: DiagnosticKind.CssConflict,
        range: range(0, 16, 0, 20),
        severity: 2,
        message: "'flex' applies the same CSS properties as 'block'.",
        relatedInformation: [
          {
            message: 'block',
            location: {
              uri: expect.stringContaining('file://projects/root/'),
              range: range(0, 21, 0, 26),
            },
          },
        ],
        className: {
          className: 'flex',
          span: [16, 20],
          range: range(0, 16, 0, 20),
          relativeRange: range(0, 4, 0, 8),
          classList: {
            classList: 'foo flex block hover:underline',
            important: undefined,
            span: [12, 42],
            range: range(0, 12, 0, 42),
          },
        },
        otherClassNames: [
          {
            className: 'block',
            span: [21, 26],
            range: range(0, 21, 0, 26),
            relativeRange: range(0, 9, 0, 14),
            classList: {
              classList: 'foo flex block hover:underline',
              important: undefined,
              span: [12, 42],
              range: range(0, 12, 0, 42),
            },
          },
        ],
      },
      {
        code: DiagnosticKind.CssConflict,
        range: range(0, 21, 0, 26),
        severity: 2,
        message: "'block' applies the same CSS properties as 'flex'.",
        relatedInformation: [
          {
            message: 'flex',
            location: {
              uri: expect.stringContaining('file://projects/root/'),
              range: range(0, 16, 0, 20),
            },
          },
        ],
        className: {
          className: 'block',
          span: [21, 26],
          range: range(0, 21, 0, 26),
          relativeRange: range(0, 9, 0, 14),
          classList: {
            classList: 'foo flex block hover:underline',
            important: undefined,
            span: [12, 42],
            range: range(0, 12, 0, 42),
          },
        },
        otherClassNames: [
          {
            className: 'flex',
            span: [16, 20],
            range: range(0, 16, 0, 20),
            relativeRange: range(0, 4, 0, 8),
            classList: {
              classList: 'foo flex block hover:underline',
              important: undefined,
              span: [12, 42],
              range: range(0, 12, 0, 42),
            },
          },
        ],
      },
    ],
  })

  runTest({
    name: 'old @tailwind directives warn when used',
    lang: 'css',
    text: css`
      @tailwind base;
      @tailwind preflight;
      @tailwind components;
      @tailwind screens;
      @tailwind variants;
    `,
    expected: [
      {
        code: DiagnosticKind.InvalidTailwindDirective,
        range: range(0, 10, 0, 14),
        severity: 1,
        message:
          "'@tailwind base' is no longer available in v4. Use '@import \"tailwindcss/preflight\"' instead.",
        suggestions: [],
      },
      {
        code: DiagnosticKind.InvalidTailwindDirective,
        range: range(1, 10, 1, 19),
        severity: 1,
        message:
          "'@tailwind preflight' is no longer available in v4. Use '@import \"tailwindcss/preflight\"' instead.",
        suggestions: [],
      },
      {
        code: DiagnosticKind.InvalidTailwindDirective,
        range: range(2, 10, 2, 20),
        severity: 1,
        message:
          "'@tailwind components' is no longer available in v4. Use '@tailwind utilities' instead.",
        suggestions: ['utilities'],
      },
      {
        code: DiagnosticKind.InvalidTailwindDirective,
        range: range(3, 10, 3, 17),
        severity: 1,
        message:
          "'@tailwind screens' is no longer available in v4. Use '@tailwind utilities' instead.",
        suggestions: ['utilities'],
      },
      {
        code: DiagnosticKind.InvalidTailwindDirective,
        range: range(4, 10, 4, 18),
        severity: 1,
        message:
          "'@tailwind variants' is no longer available in v4. Use '@tailwind utilities' instead.",
        suggestions: ['utilities'],
      },
    ],
  })

  runTest({
    name: 'conflicting classes',
    lang: 'html',
    text: html`<div class="uppercase lowercase"></div>`,
    expected: [
      {
        code: DiagnosticKind.CssConflict,
        range: range(0, 12, 0, 21),
        severity: 2,
        message: "'uppercase' applies the same CSS properties as 'lowercase'.",
        relatedInformation: [
          {
            message: 'lowercase',
            location: {
              uri: expect.stringContaining('file://projects/root/'),
              range: range(0, 22, 0, 31),
            },
          },
        ],
        className: {
          className: 'uppercase',
          classList: {
            classList: 'uppercase lowercase',
            range: range(0, 12, 0, 31),
            span: [12, 31],
          },
          relativeRange: range(0, 0, 0, 9),
          range: range(0, 12, 0, 21),
          span: [12, 21],
        },
        otherClassNames: [
          {
            className: 'lowercase',
            classList: {
              classList: 'uppercase lowercase',
              range: range(0, 12, 0, 31),
              span: [12, 31],
            },
            relativeRange: range(0, 10, 0, 19),
            range: range(0, 22, 0, 31),
            span: [22, 31],
          },
        ],
      },
      {
        code: DiagnosticKind.CssConflict,
        range: range(0, 22, 0, 31),
        severity: 2,
        message: "'lowercase' applies the same CSS properties as 'uppercase'.",
        relatedInformation: [
          {
            message: 'uppercase',
            location: {
              uri: expect.stringContaining('file://projects/root/'),
              range: range(0, 12, 0, 21),
            },
          },
        ],
        className: {
          className: 'lowercase',
          classList: {
            classList: 'uppercase lowercase',
            range: range(0, 12, 0, 31),
            span: [12, 31],
          },
          relativeRange: range(0, 10, 0, 19),
          range: range(0, 22, 0, 31),
          span: [22, 31],
        },
        otherClassNames: [
          {
            className: 'uppercase',
            classList: {
              classList: 'uppercase lowercase',
              range: range(0, 12, 0, 31),
              span: [12, 31],
            },
            relativeRange: range(0, 0, 0, 9),
            range: range(0, 12, 0, 21),
            span: [12, 21],
          },
        ],
      },
    ],
  })

  runTest({
    name: 'base + variant no conflict',
    lang: 'html',
    text: html`<div class="uppercase sm:lowercase"></div>`,
    expected: [],
  })

  runTest({
    name: 'variant + variant conflict',
    lang: 'html',
    text: html`<div class="sm:uppercase sm:lowercase"></div>`,
    expected: [
      {
        code: DiagnosticKind.CssConflict,
        range: range(0, 12, 0, 24),
        severity: 2,
        message: "'sm:uppercase' applies the same CSS properties as 'sm:lowercase'.",
        relatedInformation: [
          {
            message: 'sm:lowercase',
            location: {
              uri: expect.stringContaining('file://projects/root/'),
              range: range(0, 25, 0, 37),
            },
          },
        ],
        className: {
          className: 'sm:uppercase',
          classList: {
            classList: 'sm:uppercase sm:lowercase',
            range: range(0, 12, 0, 37),
            span: [12, 37],
          },
          relativeRange: range(0, 0, 0, 12),
          range: range(0, 12, 0, 24),
          span: [12, 24],
        },
        otherClassNames: [
          {
            className: 'sm:lowercase',
            classList: {
              classList: 'sm:uppercase sm:lowercase',
              range: range(0, 12, 0, 37),
              span: [12, 37],
            },
            relativeRange: range(0, 13, 0, 25),
            range: range(0, 25, 0, 37),
            span: [25, 37],
          },
        ],
      },
      {
        code: DiagnosticKind.CssConflict,
        range: range(0, 25, 0, 37),
        severity: 2,
        message: "'sm:lowercase' applies the same CSS properties as 'sm:uppercase'.",
        relatedInformation: [
          {
            message: 'sm:uppercase',
            location: {
              uri: expect.stringContaining('file://projects/root/'),
              range: range(0, 12, 0, 24),
            },
          },
        ],
        className: {
          className: 'sm:lowercase',
          classList: {
            classList: 'sm:uppercase sm:lowercase',
            range: range(0, 12, 0, 37),
            span: [12, 37],
          },
          relativeRange: range(0, 13, 0, 25),
          range: range(0, 25, 0, 37),
          span: [25, 37],
        },
        otherClassNames: [
          {
            className: 'sm:uppercase',
            classList: {
              classList: 'sm:uppercase sm:lowercase',
              range: range(0, 12, 0, 37),
              span: [12, 37],
            },
            relativeRange: range(0, 0, 0, 12),
            range: range(0, 12, 0, 24),
            span: [12, 24],
          },
        ],
      },
    ],
  })

  runTest({
    name: 'jsx concat does not conflict',
    lang: 'javascriptreact',
    text: js`
      <div className={'lowercase' + 'uppercase'}>
    `,
    expected: [],
  })

  runTest({
    name: 'conflicts in single jsx string',
    lang: 'javascriptreact',
    text: js`
      <div className={'lowercase uppercase' + 'uppercase'}>
    `,
    expected: [
      {
        code: DiagnosticKind.CssConflict,
        range: range(0, 17, 0, 26),
        severity: 2,
        message: "'lowercase' applies the same CSS properties as 'uppercase'.",
        relatedInformation: [
          {
            message: 'uppercase',
            location: {
              uri: expect.stringContaining('file://projects/root/'),
              range: range(0, 27, 0, 36),
            },
          },
        ],
        className: {
          className: 'lowercase',
          classList: {
            classList: 'lowercase uppercase',
            range: range(0, 17, 0, 36),
            span: [17, 36],
          },
          relativeRange: range(0, 0, 0, 9),
          range: range(0, 17, 0, 26),
          span: [17, 26],
        },
        otherClassNames: [
          {
            className: 'uppercase',
            classList: {
              classList: 'lowercase uppercase',
              range: range(0, 17, 0, 36),
              span: [17, 36],
            },
            relativeRange: range(0, 10, 0, 19),
            range: range(0, 27, 0, 36),
            span: [27, 36],
          },
        ],
      },
      {
        code: DiagnosticKind.CssConflict,
        range: range(0, 27, 0, 36),
        severity: 2,
        message: "'uppercase' applies the same CSS properties as 'lowercase'.",
        relatedInformation: [
          {
            message: 'lowercase',
            location: {
              uri: expect.stringContaining('file://projects/root/'),
              range: range(0, 17, 0, 26),
            },
          },
        ],
        className: {
          className: 'uppercase',
          classList: {
            classList: 'lowercase uppercase',
            range: range(0, 17, 0, 36),
            span: [17, 36],
          },
          relativeRange: range(0, 10, 0, 19),
          range: range(0, 27, 0, 36),
          span: [27, 36],
        },
        otherClassNames: [
          {
            className: 'lowercase',
            classList: {
              classList: 'lowercase uppercase',
              range: range(0, 17, 0, 36),
              span: [17, 36],
            },
            relativeRange: range(0, 0, 0, 9),
            range: range(0, 17, 0, 26),
            span: [17, 26],
          },
        ],
      },
    ],
  })

  runTest({
    name: 'vue + <style> + sass',
    lang: 'vue',
    text: `<style lang="sass">\n.foo\n  @apply uppercase lowercase\n</style>`,
    expected: [
      {
        code: DiagnosticKind.CssConflict,
        range: range(2, 9, 2, 18),
        severity: 2,
        message: "'uppercase' applies the same CSS properties as 'lowercase'.",
        relatedInformation: [
          {
            message: 'lowercase',
            location: {
              uri: expect.stringContaining('file://projects/root/'),
              range: range(2, 19, 2, 28),
            },
          },
        ],
        className: {
          className: 'uppercase',
          classList: {
            classList: 'uppercase lowercase',
            range: range(2, 9, 2, 28),
            span: [34, 53],
            important: false,
          },
          relativeRange: range(0, 0, 0, 9),
          range: range(2, 9, 2, 18),
          span: [34, 43],
        },
        otherClassNames: [
          {
            className: 'lowercase',
            classList: {
              classList: 'uppercase lowercase',
              range: range(2, 9, 2, 28),
              span: [34, 53],
              important: false,
            },
            relativeRange: range(0, 10, 0, 19),
            range: range(2, 19, 2, 28),
            span: [44, 53],
          },
        ],
      },
      {
        code: DiagnosticKind.CssConflict,
        range: range(2, 19, 2, 28),
        severity: 2,
        message: "'lowercase' applies the same CSS properties as 'uppercase'.",
        relatedInformation: [
          {
            message: 'uppercase',
            location: {
              uri: expect.stringContaining('file://projects/root/'),
              range: range(2, 9, 2, 18),
            },
          },
        ],
        className: {
          className: 'lowercase',
          classList: {
            classList: 'uppercase lowercase',
            range: range(2, 9, 2, 28),
            span: [34, 53],
            important: false,
          },
          relativeRange: range(0, 10, 0, 19),
          range: range(2, 19, 2, 28),
          span: [44, 53],
        },
        otherClassNames: [
          {
            className: 'uppercase',
            classList: {
              classList: 'uppercase lowercase',
              range: range(2, 9, 2, 28),
              span: [34, 53],
              important: false,
            },
            relativeRange: range(0, 0, 0, 9),
            range: range(2, 9, 2, 18),
            span: [34, 43],
          },
        ],
      },
    ],
  })

  runTest({
    name: 'conflict in @apply',
    lang: 'css',
    text: '.test { @apply uppercase lowercase }',
    expected: [
      {
        code: DiagnosticKind.CssConflict,
        range: range(0, 15, 0, 24),
        severity: 2,
        message: "'uppercase' applies the same CSS properties as 'lowercase'.",
        relatedInformation: [
          {
            message: 'lowercase',
            location: {
              uri: expect.stringContaining('file://projects/root/'),
              range: range(0, 25, 0, 34),
            },
          },
        ],
        className: {
          className: 'uppercase',
          classList: {
            classList: 'uppercase lowercase',
            range: range(0, 15, 0, 34),
            span: [15, 34],
            important: false,
          },
          relativeRange: range(0, 0, 0, 9),
          range: range(0, 15, 0, 24),
          span: [15, 24],
        },
        otherClassNames: [
          {
            className: 'lowercase',
            classList: {
              classList: 'uppercase lowercase',
              range: range(0, 15, 0, 34),
              span: [15, 34],
              important: false,
            },
            relativeRange: range(0, 10, 0, 19),
            range: range(0, 25, 0, 34),
            span: [25, 34],
          },
        ],
      },
      {
        code: DiagnosticKind.CssConflict,
        range: range(0, 25, 0, 34),
        severity: 2,
        message: "'lowercase' applies the same CSS properties as 'uppercase'.",
        relatedInformation: [
          {
            message: 'uppercase',
            location: {
              uri: expect.stringContaining('file://projects/root/'),
              range: range(0, 15, 0, 24),
            },
          },
        ],
        className: {
          className: 'lowercase',
          classList: {
            classList: 'uppercase lowercase',
            range: range(0, 15, 0, 34),
            span: [15, 34],
            important: false,
          },
          relativeRange: range(0, 10, 0, 19),
          range: range(0, 25, 0, 34),
          span: [25, 34],
        },
        otherClassNames: [
          {
            className: 'uppercase',
            classList: {
              classList: 'uppercase lowercase',
              range: range(0, 15, 0, 34),
              span: [15, 34],
              important: false,
            },
            relativeRange: range(0, 0, 0, 9),
            range: range(0, 15, 0, 24),
            span: [15, 24],
          },
        ],
      },
    ],
  })

  runTest({
    name: 'multiple @apply rules do not conflict with each other (multiple rules)',
    lang: 'css',
    text: '.test { @apply uppercase }\n.test { @apply lowercase }',
    expected: [],
  })

  runTest({
    name: 'multiple @apply rules do not conflict with each other (multiple props)',
    lang: 'css',
    text: '.test { @apply uppercase; color: red; @apply lowercase }',
    expected: [],
  })

  //
  // @source
  //
  runTest({
    name: 'Source directives require paths',
    lang: 'css',
    text: css`
      @import 'tailwindcss' source();
      @import 'tailwindcss' source('');
      @import 'tailwindcss' source('');
      @tailwind utilities source();
      @tailwind utilities source('');
      @tailwind utilities source("");
    `,
    expected: [
      {
        code: DiagnosticKind.InvalidSourceDirective,
        range: range(0, 29, 0, 29),
        severity: 1,
        message: 'The source directive requires a path to a directory.',
      },
      {
        code: DiagnosticKind.InvalidSourceDirective,
        range: range(1, 29, 1, 31),
        severity: 1,
        message: 'The source directive requires a path to a directory.',
      },
      {
        code: DiagnosticKind.InvalidSourceDirective,
        range: range(2, 29, 2, 31),
        severity: 1,
        message: 'The source directive requires a path to a directory.',
      },
      {
        code: DiagnosticKind.InvalidSourceDirective,
        range: range(3, 27, 3, 27),
        severity: 1,
        message: 'The source directive requires a path to a directory.',
      },
      {
        code: DiagnosticKind.InvalidSourceDirective,
        range: range(4, 27, 4, 29),
        severity: 1,
        message: 'The source directive requires a path to a directory.',
      },
      {
        code: DiagnosticKind.InvalidSourceDirective,
        range: range(5, 27, 5, 29),
        severity: 1,
        message: 'The source directive requires a path to a directory.',
      },
    ],
  })

  runTest({
    name: 'source(none) must not be misspelled',
    lang: 'css',
    text: css`
      @import 'tailwindcss' source(no);
      @tailwind utilities source(no);
    `,
    expected: [
      {
        code: DiagnosticKind.InvalidSourceDirective,
        severity: 1,
        message: '`source(no)` is invalid. Did you mean `source(none)`?',
        range: range(0, 29, 0, 31),
      },
      {
        code: DiagnosticKind.InvalidSourceDirective,
        severity: 1,
        message: '`source(no)` is invalid. Did you mean `source(none)`?',
        range: range(1, 27, 1, 29),
      },
    ],
  })

  runTest({
    name: 'source("…") does not produce diagnostics',
    lang: 'css',
    text: css`
      @import 'tailwindcss' source('../app');
      @tailwind utilities source('../app');
      @import 'tailwindcss' source('../app');
      @tailwind utilities source("../app");
    `,
    expected: [],
  })

  runTest({
    name: 'paths given to source("…") must error when not POSIX',
    lang: 'css',
    text: css`
      @import 'tailwindcss' source('C:\\absolute\\path');
      @import 'tailwindcss' source('C:relative.txt');
    `,
    expected: [
      {
        code: DiagnosticKind.InvalidSourceDirective,
        severity: 1,
        range: range(0, 29, 0, 49),
        message:
          'POSIX-style paths are required with `source(…)` but `C:\\absolute\\path` is a Windows-style path.',
      },
      {
        code: DiagnosticKind.InvalidSourceDirective,
        severity: 1,
        range: range(1, 29, 1, 45),
        message:
          'POSIX-style paths are required with `source(…)` but `C:relative.txt` is a Windows-style path.',
      },
    ],
  })
})
