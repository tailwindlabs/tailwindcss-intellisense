// @ts-check

import { expect } from 'vitest'
import { css, defineTest, html, js, json, symlinkTo } from '../../src/testing'
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
        version: '4.1.1',
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

    expect(completion?.items.length).not.toBe(0)
  },
})

defineTest({
  name: 'v4, no npm, bundled plugins',
  fs: {
    'app.css': css`
      @import 'tailwindcss';
      @plugin "@tailwindcss/aspect-ratio";
      @plugin "@tailwindcss/forms";
      @plugin "@tailwindcss/typography";
    `,
  },

  // Note this test MUST run in spawn mode because Vitest hooks into import,
  // require, etc… already and we need to test that any hooks are working
  // without outside interference.
  prepare: async ({ root }) => ({ client: await createClient({ root }) }),

  handle: async ({ client }) => {
    let doc = await client.open({
      lang: 'html',
      text: '<div class="prose-slate form-select aspect-w-2"></div>',
    })

    // <div class="prose-slate form-select aspect-w-2"></div>
    //             ^
    let hover = await doc.hover({ line: 0, character: 13 })
    expect(hover).not.toEqual(null)

    // <div class="prose-slate form-select aspect-w-2"></div>
    //                         ^
    hover = await doc.hover({ line: 0, character: 25 })
    expect(hover).not.toEqual(null)

    // <div class="prose-slate form-select aspect-w-2"></div>
    //                                     ^
    hover = await doc.hover({ line: 0, character: 37 })
    expect(hover).not.toEqual(null)
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
        version: '4.1.1',
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
          "tailwindcss": "4.1.1"
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
        version: '4.1.1',
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

    expect(completion?.items.length).not.toBe(0)
  },
})

defineTest({
  name: 'v4, uses npm, does not detect v3 config files as possible roots',
  fs: {
    'package.json': json`
      {
        "dependencies": {
          "tailwindcss": "4.1.1"
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
        version: '4.1.1',
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
        version: '4.1.1',
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
          "tailwindcss": "4.1.1"
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
  // This test sometimes takes a really long time on Windows because… Windows.
  options: {
    retry: 3,
    timeout: 30_000,
  },

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
  // This test sometimes takes a really long time on Windows because… Windows.
  options: {
    retry: 3,
    timeout: 30_000,
  },

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

defineTest({
  // This test sometimes takes a really long time on Windows because… Windows.
  options: {
    retry: 3,
    timeout: 30_000,
  },

  // This test *always* passes inside Vitest because our custom version of
  // `Module._resolveFilename` is not called. Our custom implementation is
  // using enhanced-resolve under the hood which is affected by the `#`
  // character issue being considered a fragment identifier.
  //
  // This most commonly happens when dealing with PNPM packages that point
  // to a specific commit hash of a git repository.
  //
  // To simulate this, we need to:
  // - Add a local package to package.json
  // - Symlink that local package to a directory with `#` in the name
  // - Then run the test in a separate process (`spawn` mode)
  //
  // We can't use `file:./a#b` because NPM considers `#` to be a fragment
  // identifier and will not resolve the path the way we need it to.
  name: 'v3: require() works when path is resolved to contain a `#`',
  fs: {
    'package.json': json`
      {
        "dependencies": {
          "tailwindcss": "3.4.17",
          "some-pkg": "file:./packages/some-pkg"
        }
      }
    `,
    'tailwind.config.js': js`
      module.exports = {
        presets: [require('some-pkg/config/tailwind.config.js').default]
      }
    `,
    'packages/some-pkg': symlinkTo('packages/some-pkg#c3f1e', 'dir'),
    'packages/some-pkg#c3f1e/package.json': json`
      {
        "name": "some-pkg",
        "version": "1.0.0",
        "main": "index.js"
      }
    `,
    'packages/some-pkg#c3f1e/config/tailwind.config.js': js`
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
  prepare: async ({ root }) => ({
    client: await createClient({
      root,
      mode: 'spawn',
    }),
  }),
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
  name: 'regex literals do not break language boundaries',
  fs: {
    'app.css': css`
      @import 'tailwindcss';
    `,
  },
  prepare: async ({ root }) => ({ client: await createClient({ root }) }),
  handle: async ({ client }) => {
    let doc = await client.open({
      lang: 'javascriptreact',
      text: js`
        export default function Page() {
          let styles = "str".match(/<style>[\s\S]*?<\/style>/m)
          return <div className="bg-[#000]">{styles}</div>
        }
      `,
    })

    expect(await client.project()).toMatchObject({
      tailwind: {
        version: '4.1.1',
        isDefaultVersion: true,
      },
    })

    //   return <div className="bg-[#000]">{styles}</div>
    //                          ^
    let hover = await doc.hover({ line: 2, character: 26 })

    expect(hover).toEqual({
      contents: {
        language: 'css',
        value: dedent`
          .bg-\[\#000\] {
            background-color: #000;
          }
        `,
      },
      range: {
        start: { line: 2, character: 25 },
        end: { line: 2, character: 34 },
      },
    })
  },
})
