import { expect } from 'vitest'
import { init } from '../common'
import { HoverRequest } from 'vscode-languageserver'
import { css, defineTest, html, js, json } from '../../src/testing'
import dedent from 'dedent'
import { CompletionRequest } from 'vscode-languageserver-protocol'

defineTest({
  name: 'v4, no npm, uses fallback',
  fs: {
    'app.css': css`
      @import 'tailwindcss';
    `,
  },
  prepare: async ({ root }) => ({ c: await init(root) }),
  handle: async ({ c }) => {
    let textDocument = await c.openDocument({
      lang: 'html',
      text: '<div class="bg-[#000]/25 hover:">',
    })

    expect(c.project).toMatchObject({
      tailwind: {
        version: '4.0.6',
        isDefaultVersion: true,
      },
    })

    let hover = await c.sendRequest(HoverRequest.type, {
      textDocument,

      // <div class="bg-[#000]/25 hover:
      //             ^
      position: { line: 0, character: 13 },
    })

    let completion = await c.sendRequest(CompletionRequest.type, {
      textDocument,
      context: { triggerKind: 1 },

      // <div class="bg-[#000]/25 hover:
      //                               ^
      position: { line: 0, character: 31 },
    })

    expect(hover).toEqual({
      contents: {
        language: 'css',
        value: dedent`
          .bg-\[\#000\]\/25 {
            background-color: color-mix(in oklab, #000 25%, transparent);
          }
        `,
      },
      range: {
        start: { line: 0, character: 12 },
        end: { line: 0, character: 24 },
      },
    })

    expect(completion.items.length).toBe(12288)
  },
})

defineTest({
  /**
   * Plugins and configs that import stuff from the `tailwindcss` package do
   * not work because we need to register ESM loader hooks as well as hooking
   * into require(), createRequire(), etc… even for require() used indirectly
   * through an ESM-imported file.
   *
   * This is not 100% possible before Node v23.6.0 but we should be able to get
   * close to that by using async loaders but there's still a lot of work to do
   * to make that a workable solution.
   */
  options: { skip: true },

  name: 'v4, no npm, with plugins',
  fs: {
    'app.css': css`
      @import 'tailwindcss';
      @plugin "./plugin.js";
    `,
    'plugin.js': js`
      import plugin from 'tailwindcss/plugin'

      export default plugin(function ({ addUtilities }) {
        addUtilities({
          '.example': {
            color: 'red',
          },
        })
      })
    `,
  },

  // Note this test MUST run in spawn mode because Vitest hooks into import,
  // require, etc… already and we need to test that any hooks are working
  // without outside interference.
  prepare: async ({ root }) => ({
    c: await init(root, { mode: 'spawn' }),
  }),

  handle: async ({ c }) => {
    let textDocument = await c.openDocument({
      lang: 'html',
      text: '<div class="underline example">',
    })

    expect(c.project).toMatchObject({
      tailwind: {
        version: '4.0.6',
        isDefaultVersion: true,
      },
    })

    let hover = await c.sendRequest(HoverRequest.type, {
      textDocument,

      // <div class="underline example">
      //             ^
      position: { line: 0, character: 13 },
    })

    expect(hover).toEqual({
      contents: {
        language: 'css',
        value: dedent`
          .underline {
            text-decoration-line: underline;
          }
        `,
      },
      range: {
        start: { line: 0, character: 12 },
        end: { line: 0, character: 21 },
      },
    })

    let hoverFromPlugin = await c.sendRequest(HoverRequest.type, {
      textDocument,

      // <div class="underline example">
      //                       ^
      position: { line: 0, character: 23 },
    })

    expect(hoverFromPlugin).toEqual({
      contents: {
        language: 'css',
        value: dedent`
          .example {
            color: red;
          }
        `,
      },
      range: {
        start: { line: 0, character: 22 },
        end: { line: 0, character: 29 },
      },
    })
  },
})

defineTest({
  name: 'v4, with npm, uses local',
  fs: {
    'package.json': json`
      {
        "dependencies": {
          "tailwindcss": "4.0.1"
        }
      }
    `,
    'app.css': css`
      @import 'tailwindcss';
    `,
  },
  prepare: async ({ root }) => ({ c: await init(root) }),
  handle: async ({ c }) => {
    let textDocument = await c.openDocument({
      lang: 'html',
      text: '<div class="bg-[#000]/25 hover:">',
    })

    expect(c.project).toMatchObject({
      tailwind: {
        version: '4.0.1',
        isDefaultVersion: false,
      },
    })

    let hover = await c.sendRequest(HoverRequest.type, {
      textDocument,

      // <div class="bg-[#000]/25 hover:
      //             ^
      position: { line: 0, character: 13 },
    })

    let completion = await c.sendRequest(CompletionRequest.type, {
      textDocument,
      context: { triggerKind: 1 },

      // <div class="bg-[#000]/25 hover:
      //                               ^
      position: { line: 0, character: 31 },
    })

    expect(hover).toEqual({
      contents: {
        language: 'css',
        value: dedent`
          .bg-\[\#000\]\/25 {
            background-color: color-mix(in oklab, #000 25%, transparent);
          }
        `,
      },
      range: {
        start: { line: 0, character: 12 },
        end: { line: 0, character: 24 },
      },
    })

    expect(completion.items.length).toBe(12288)
  },
})

defineTest({
  name: 'v4, uses npm, does not detect v3 config files as possible roots',
  fs: {
    'package.json': json`
      {
        "dependencies": {
          "tailwindcss": "4.0.1"
        }
      }
    `,
    // This file MUST be before the v4 CSS file when sorting alphabetically
    '_globals.css': css`
      @tailwind base;
      @tailwind utilities;
      @tailwind components;
    `,
    'app.css': css`
      @import 'tailwindcss';

      @theme {
        --color-primary: #c0ffee;
      }
    `,
  },
  prepare: async ({ root }) => ({ c: await init(root) }),
  handle: async ({ c }) => {
    let textDocument = await c.openDocument({
      lang: 'html',
      text: '<div class="bg-primary">',
    })

    expect(c.project).toMatchObject({
      tailwind: {
        version: '4.0.1',
        isDefaultVersion: false,
      },
    })

    let hover = await c.sendRequest(HoverRequest.type, {
      textDocument,

      // <div class="bg-primary">
      //             ^
      position: { line: 0, character: 13 },
    })

    expect(hover).toEqual({
      contents: {
        language: 'css',
        value: dedent`
          .bg-primary {
            background-color: var(--color-primary) /* #c0ffee */;
          }
        `,
      },
      range: {
        start: { line: 0, character: 12 },
        end: { line: 0, character: 22 },
      },
    })
  },
})

defineTest({
  name: 'v4, uses fallback, does not detect v3 config files as possible roots',
  fs: {
    // This file MUST be before the v4 CSS file when sorting alphabetically
    '_globals.css': css`
      @tailwind base;
      @tailwind utilities;
      @tailwind components;
    `,
    'app.css': css`
      @import 'tailwindcss';

      @theme {
        --color-primary: #c0ffee;
      }
    `,
  },
  prepare: async ({ root }) => ({ c: await init(root) }),
  handle: async ({ c }) => {
    let textDocument = await c.openDocument({
      lang: 'html',
      text: '<div class="bg-primary">',
    })

    expect(c.project).toMatchObject({
      tailwind: {
        version: '4.0.6',
        isDefaultVersion: true,
      },
    })

    let hover = await c.sendRequest(HoverRequest.type, {
      textDocument,

      // <div class="bg-primary">
      //             ^
      position: { line: 0, character: 13 },
    })

    expect(hover).toEqual({
      contents: {
        language: 'css',
        value: dedent`
          .bg-primary {
            background-color: var(--color-primary) /* #c0ffee */;
          }
        `,
      },
      range: {
        start: { line: 0, character: 12 },
        end: { line: 0, character: 22 },
      },
    })
  },
})

defineTest({
  name: 'v4, using local, with explicit CSS entrypoints',
  fs: {
    'package.json': json`
      {
        "dependencies": {
          "tailwindcss": "4.0.1"
        }
      }
    `,
    'a/app.css': css`
      @import 'tailwindcss';
      @theme {
        --color-primary: #000000;
      }
    `,
    'b/app.css': css`
      @import 'tailwindcss';
      @theme {
        --color-primary: #ffffff;
      }
    `,
  },
  prepare: async ({ root }) => ({ c: await init(root) }),
  handle: async ({ c }) => {
    await c.updateSettings({
      tailwindCSS: {
        experimental: {
          configFile: {
            'a/app.css': 'c/a/**',
            'b/app.css': 'c/b/**',
          },
        },
      },
    })

    let documentA = await c.openDocument({
      lang: 'html',
      text: '<div class="bg-primary">',
      name: 'c/a/index.html',
    })

    let documentB = await c.openDocument({
      lang: 'html',
      text: '<div class="bg-primary">',
      name: 'c/b/index.html',
    })

    let hoverA = await c.sendRequest(HoverRequest.type, {
      textDocument: documentA,

      // <div class="bg-primary">
      //             ^
      position: { line: 0, character: 13 },
    })

    let hoverB = await c.sendRequest(HoverRequest.type, {
      textDocument: documentB,

      // <div class="bg-primary">
      //             ^
      position: { line: 0, character: 13 },
    })

    expect(hoverA).toEqual({
      contents: {
        language: 'css',
        value: dedent`
          .bg-primary {
            background-color: var(--color-primary) /* #000000 */;
          }
        `,
      },
      range: {
        start: { line: 0, character: 12 },
        end: { line: 0, character: 22 },
      },
    })

    expect(hoverB).toEqual({
      contents: {
        language: 'css',
        value: dedent`
          .bg-primary {
            background-color: var(--color-primary) /* #ffffff */;
          }
        `,
      },
      range: {
        start: { line: 0, character: 12 },
        end: { line: 0, character: 22 },
      },
    })
  },
})

defineTest({
  name: 'v4, using fallback, with explicit CSS entrypoints',
  fs: {
    'a/app.css': css`
      @import 'tailwindcss';
      @theme {
        --color-primary: #000000;
      }
    `,
    'b/app.css': css`
      @import 'tailwindcss';
      @theme {
        --color-primary: #ffffff;
      }
    `,
  },
  prepare: async ({ root }) => ({ c: await init(root) }),
  handle: async ({ c }) => {
    await c.updateSettings({
      tailwindCSS: {
        experimental: {
          configFile: {
            'a/app.css': 'c/a/**',
            'b/app.css': 'c/b/**',
          },
        },
      },
    })

    let documentA = await c.openDocument({
      lang: 'html',
      text: '<div class="bg-primary">',
      name: 'c/a/index.html',
    })

    let documentB = await c.openDocument({
      lang: 'html',
      text: '<div class="bg-primary">',
      name: 'c/b/index.html',
    })

    let hoverA = await c.sendRequest(HoverRequest.type, {
      textDocument: documentA,

      // <div class="bg-primary">
      //             ^
      position: { line: 0, character: 13 },
    })

    let hoverB = await c.sendRequest(HoverRequest.type, {
      textDocument: documentB,

      // <div class="bg-primary">
      //             ^
      position: { line: 0, character: 13 },
    })

    expect(hoverA).toEqual({
      contents: {
        language: 'css',
        value: dedent`
          .bg-primary {
            background-color: var(--color-primary) /* #000000 */;
          }
        `,
      },
      range: {
        start: { line: 0, character: 12 },
        end: { line: 0, character: 22 },
      },
    })

    expect(hoverB).toEqual({
      contents: {
        language: 'css',
        value: dedent`
          .bg-primary {
            background-color: var(--color-primary) /* #ffffff */;
          }
        `,
      },
      range: {
        start: { line: 0, character: 12 },
        end: { line: 0, character: 22 },
      },
    })
  },
})

defineTest({
  name: 'script + lang=tsx is treated as containing JSX',
  fs: {
    'app.css': css`
      @import 'tailwindcss';
    `,
  },
  prepare: async ({ root }) => ({ c: await init(root) }),
  handle: async ({ c }) => {
    let document = await c.openDocument({
      lang: 'vue',
      text: html`
        <script lang="tsx">
          function App() {
            return <div class="bg-black" />
          }
        </script>
      `,
    })

    let hover = await c.sendRequest(HoverRequest.type, {
      textDocument: document,

      //    return <div class="bg-black" />
      //                       ^
      position: { line: 2, character: 24 },
    })

    expect(hover).toEqual({
      contents: {
        language: 'css',
        value: dedent`
          .bg-black {
            background-color: var(--color-black) /* #000 = #000000 */;
          }
        `,
      },
      range: {
        start: { line: 2, character: 23 },
        end: { line: 2, character: 31 },
      },
    })
  },
})

defineTest({
  name: 'v4, multiple files, only one root',
  fs: {
    'buttons.css': css`
      .foo {
        @apply bg-black;
      }
    `,
    'styles.css': css`
      @import 'tailwindcss';
    `,
  },
  prepare: async ({ root }) => ({ c: await init(root) }),
  handle: async ({ c }) => {
    let document = await c.openDocument({
      lang: 'html',
      text: '<div class="bg-black">',
    })

    let hover = await c.sendRequest(HoverRequest.type, {
      textDocument: document,

      // <div class="bg-black">
      //             ^
      position: { line: 0, character: 13 },
    })

    expect(hover).toEqual({
      contents: {
        language: 'css',
        value: dedent`
          .bg-black {
            background-color: var(--color-black) /* #000 = #000000 */;
          }
        `,
      },
      range: {
        start: { line: 0, character: 12 },
        end: { line: 0, character: 20 },
      },
    })
  },
})

defineTest({
  name: 'Plugins with a `#` in the name are loadable',
  fs: {
    'app.css': css`
      @import 'tailwindcss';
      @plugin './a#b.js';
    `,
    'a#b.js': js`
      export default function ({ addUtilities }) {
        addUtilities({
          '.example': {
            color: 'red',
          },
        })
      }
    `,
  },
  prepare: async ({ root }) => ({ c: await init(root) }),
  handle: async ({ c }) => {
    let document = await c.openDocument({
      lang: 'html',
      text: '<div class="example">',
    })

    // <div class="example">
    //             ^
    let hover = await c.sendRequest(HoverRequest.type, {
      textDocument: document,
      position: { line: 0, character: 13 },
    })

    expect(hover).toEqual({
      contents: {
        language: 'css',
        value: dedent`
          .example {
            color: red;
          }
        `,
      },
      range: {
        start: { line: 0, character: 12 },
        end: { line: 0, character: 19 },
      },
    })
  },
})
