// @ts-check

import { expect } from 'vitest'
import { css, defineTest, html, js, json } from '../../src/testing'
import dedent from 'dedent'
import { createClient } from '../utils/client'

defineTest({
  name: 'v4, no npm, uses fallback',
  fs: {
    'app.css': css`
      @import 'tailwindcss';
    `,
  },
  prepare: async ({ root }) => ({ client: await createClient({ root }) }),
  handle: async ({ client }) => {
    let doc = await client.open({
      lang: 'html',
      text: '<div class="bg-[#000]/25 hover:">',
    })

    expect(await client.project()).toMatchObject({
      tailwind: {
        version: '4.0.6',
        isDefaultVersion: true,
      },
    })

    // <div class="bg-[#000]/25 hover:
    //             ^
    let hover = await doc.hover({ line: 0, character: 13 })

    // <div class="bg-[#000]/25 hover:
    //                               ^
    let completion = await doc.completions({ line: 0, character: 31 })

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

    expect(completion?.items.length).toBe(12288)
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
  prepare: async ({ root }) => ({ client: await createClient({ root, mode: 'spawn' }) }),

  handle: async ({ client }) => {
    let doc = await client.open({
      lang: 'html',
      text: '<div class="underline example">',
    })

    expect(await client.project()).toMatchObject({
      tailwind: {
        version: '4.0.6',
        isDefaultVersion: true,
      },
    })

    // <div class="underline example">
    //             ^
    let hover = await doc.hover({ line: 0, character: 13 })

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

    // <div class="underline example">
    //                       ^
    let hoverFromPlugin = await doc.hover({ line: 0, character: 23 })

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
  prepare: async ({ root }) => ({ client: await createClient({ root }) }),
  handle: async ({ client }) => {
    let doc = await client.open({
      lang: 'html',
      text: '<div class="bg-[#000]/25 hover:">',
    })

    expect(await client.project()).toMatchObject({
      tailwind: {
        version: '4.0.1',
        isDefaultVersion: false,
      },
    })

    // <div class="bg-[#000]/25 hover:">
    //             ^
    let hover = await doc.hover({ line: 0, character: 13 })

    // <div class="bg-[#000]/25 hover:">
    //                               ^
    let completion = await doc.completions({ line: 0, character: 31 })

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

    expect(completion?.items.length).toBe(12288)
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
  prepare: async ({ root }) => ({ client: await createClient({ root }) }),
  handle: async ({ client }) => {
    let doc = await client.open({
      lang: 'html',
      text: '<div class="bg-primary">',
    })

    expect(await client.project()).toMatchObject({
      tailwind: {
        version: '4.0.1',
        isDefaultVersion: false,
      },
    })

    // <div class="bg-primary">
    //             ^
    let hover = await doc.hover({ line: 0, character: 13 })

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
  prepare: async ({ root }) => ({ client: await createClient({ root }) }),
  handle: async ({ client }) => {
    let doc = await client.open({
      lang: 'html',
      text: '<div class="bg-primary">',
    })

    expect(await client.project()).toMatchObject({
      tailwind: {
        version: '4.0.6',
        isDefaultVersion: true,
      },
    })

    // <div class="bg-primary">
    //             ^
    let hover = await doc.hover({ line: 0, character: 13 })

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
  prepare: async ({ root }) => ({
    client: await createClient({
      root,
      settings: {
        tailwindCSS: {
          experimental: {
            configFile: {
              'a/app.css': 'c/a/**',
              'b/app.css': 'c/b/**',
            },
          },
        },
      },
    }),
  }),
  handle: async ({ client }) => {
    let documentA = await client.open({
      lang: 'html',
      text: '<div class="bg-primary">',
      name: 'c/a/index.html',
    })

    let documentB = await client.open({
      lang: 'html',
      text: '<div class="bg-primary">',
      name: 'c/b/index.html',
    })

    // <div class="bg-primary">
    //             ^
    let hoverA = await documentA.hover({ line: 0, character: 13 })

    // <div class="bg-primary">
    //             ^
    let hoverB = await documentB.hover({ line: 0, character: 13 })

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
  prepare: async ({ root }) => ({
    client: await createClient({
      root,
      settings: {
        tailwindCSS: {
          experimental: {
            configFile: {
              'a/app.css': 'c/a/**',
              'b/app.css': 'c/b/**',
            },
          },
        },
      },
    }),
  }),
  handle: async ({ client }) => {
    let documentA = await client.open({
      lang: 'html',
      text: '<div class="bg-primary">',
      name: 'c/a/index.html',
    })

    let documentB = await client.open({
      lang: 'html',
      text: '<div class="bg-primary">',
      name: 'c/b/index.html',
    })

    // <div class="bg-primary">
    //             ^
    let hoverA = await documentA.hover({ line: 0, character: 13 })

    // <div class="bg-primary">
    //             ^
    let hoverB = await documentB.hover({ line: 0, character: 13 })

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
  prepare: async ({ root }) => ({ client: await createClient({ root }) }),
  handle: async ({ client }) => {
    let document = await client.open({
      lang: 'vue',
      text: html`
        <script lang="tsx">
          function App() {
            return <div class="bg-black" />
          }
        </script>
      `,
    })

    //    return <div class="bg-black" />
    //                       ^
    let hover = await document.hover({ line: 2, character: 24 })

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
  prepare: async ({ root }) => ({ client: await createClient({ root }) }),
  handle: async ({ client }) => {
    let document = await client.open({
      lang: 'html',
      text: '<div class="bg-black">',
    })

    // <div class="bg-black">
    //             ^
    let hover = await document.hover({ line: 0, character: 13 })

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
  prepare: async ({ root }) => ({ client: await createClient({ root }) }),
  handle: async ({ client }) => {
    let document = await client.open({
      lang: 'html',
      text: '<div class="example">',
    })

    // <div class="example">
    //             ^
    let hover = await document.hover({ line: 0, character: 13 })

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

defineTest({
  name: 'v3: Presets with a `#` in the name are loadable',
  fs: {
    'package.json': json`
      {
        "dependencies": {
          "tailwindcss": "3.4.17"
        }
      }
    `,
    'tailwind.config.js': js`
      module.exports = {
        presets: [require('./a#b.js').default]
      }
    `,
    'a#b.js': js`
      export default {
        plugins: [
          function ({ addUtilities }) {
            addUtilities({
              '.example': {
                color: 'red',
              },
            })
          }
        ]
      }
    `,
  },
  prepare: async ({ root }) => ({ client: await createClient({ root }) }),
  handle: async ({ client }) => {
    let document = await client.open({
      lang: 'html',
      text: '<div class="example">',
    })

    // <div class="example">
    //             ^
    let hover = await document.hover({ line: 0, character: 13 })

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
