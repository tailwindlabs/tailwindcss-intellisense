import { expect } from 'vitest'
import { css, defineTest } from '../../src/testing'
import { createClient } from '../utils/client'
import { SymbolKind } from 'vscode-languageserver'

defineTest({
  name: '@custom-variant',
  prepare: async ({ root }) => ({
    client: await createClient({
      server: 'css',
      root,
    }),
  }),
  handle: async ({ client }) => {
    let doc = await client.open({
      lang: 'tailwindcss',
      name: 'file-1.css',
      text: css`
        @import 'tailwindcss';
        @custom-variant foo (&:hover);
        @custom-variant bar {
          &:hover {
            @slot;
          }
        }
      `,
    })

    // No errors
    expect(await doc.diagnostics()).toEqual([])

    // Symbols show up for @custom-variant
    expect(await doc.symbols()).toMatchObject([
      {
        kind: SymbolKind.Module,
        name: '@custom-variant foo (&:hover)',
        location: {
          uri: '{workspace:default}/file-1.css',
          range: {
            start: { line: 1, character: 0 },
            end: { line: 1, character: 31 },
          },
        },
      },
      {
        kind: SymbolKind.Class,
        name: '@custom-variant bar',
        location: {
          uri: '{workspace:default}/file-1.css',
          range: {
            start: { line: 2, character: 0 },
            end: { line: 6, character: 1 },
          },
        },
      },
      {
        kind: SymbolKind.Class,
        name: '&:hover',
        location: {
          uri: '{workspace:default}/file-1.css',
          range: {
            start: { line: 3, character: 2 },
            end: { line: 5, character: 3 },
          },
        },
      },
    ])
  },
})

defineTest({
  name: '@variant',
  prepare: async ({ root }) => ({
    client: await createClient({
      server: 'css',
      root,
    }),
  }),
  handle: async ({ client }) => {
    let doc = await client.open({
      lang: 'tailwindcss',
      name: 'file-1.css',
      text: css`
        @import 'tailwindcss';
        @variant dark {
          .foo {
            color: black;
          }
        }
        .bar {
          @variant dark {
            color: black;
          }
        }
      `,
    })

    // No errors
    expect(await doc.diagnostics()).toEqual([])

    // Symbols show up for @custom-variant
    expect(await doc.symbols()).toMatchObject([
      {
        kind: SymbolKind.Class,
        name: '@variant dark',
        location: {
          uri: '{workspace:default}/file-1.css',
          range: {
            start: { line: 1, character: 0 },
            end: { line: 5, character: 1 },
          },
        },
      },
      {
        kind: SymbolKind.Class,
        name: '.foo',
        location: {
          uri: '{workspace:default}/file-1.css',
          range: {
            start: { line: 2, character: 2 },
            end: { line: 4, character: 3 },
          },
        },
      },
      {
        kind: SymbolKind.Class,
        name: '.bar',
        location: {
          uri: '{workspace:default}/file-1.css',
          range: {
            start: { line: 6, character: 0 },
            end: { line: 10, character: 1 },
          },
        },
      },
      {
        kind: SymbolKind.Class,
        name: '@variant dark',
        location: {
          uri: '{workspace:default}/file-1.css',
          range: {
            start: { line: 7, character: 2 },
            end: { line: 9, character: 3 },
          },
        },
      },
    ])
  },
})

defineTest({
  name: '@utility',
  prepare: async ({ root }) => ({
    client: await createClient({
      server: 'css',
      root,
    }),
  }),
  handle: async ({ client }) => {
    let doc = await client.open({
      lang: 'tailwindcss',
      name: 'file-1.css',
      text: css`
        @import 'tailwindcss';
        @utility example {
          color: black;
        }
        @utility tab-size-* {
          tab-size: --value(--tab-size);
        }
      `,
    })

    // No errors
    expect(await doc.diagnostics()).toEqual([])

    // Symbols show up for @custom-variant
    expect(await doc.symbols()).toMatchObject([
      {
        kind: SymbolKind.Class,
        name: '@utility example',
        location: {
          uri: '{workspace:default}/file-1.css',
          range: {
            start: { line: 1, character: 0 },
            end: { line: 3, character: 1 },
          },
        },
      },
      {
        kind: SymbolKind.Class,
        name: '@utility tab-size-*',
        location: {
          uri: '{workspace:default}/file-1.css',
          range: {
            start: { line: 4, character: 0 },
            end: { line: 6, character: 1 },
          },
        },
      },
    ])
  },
})

defineTest({
  name: '@theme',
  prepare: async ({ root }) => ({
    client: await createClient({
      server: 'css',
      root,
    }),
  }),
  handle: async ({ client }) => {
    let doc = await client.open({
      lang: 'tailwindcss',
      name: 'file-1.css',
      text: css`
        @import 'tailwindcss';
        @theme {
          --color-primary: #333;
        }
      `,
    })

    // No errors
    expect(await doc.diagnostics()).toEqual([])

    // Symbols show up for @theme
    expect(await doc.symbols()).toMatchObject([
      {
        kind: SymbolKind.Class,
        name: '@theme ',
        location: {
          uri: '{workspace:default}/file-1.css',
          range: {
            start: { line: 1, character: 0 },
            end: { line: 3, character: 1 },
          },
        },
      },
    ])
  },
})

defineTest({
  name: '@layer statement',
  prepare: async ({ root }) => ({
    client: await createClient({
      server: 'css',
      root,
    }),
  }),
  handle: async ({ client }) => {
    let doc = await client.open({
      lang: 'tailwindcss',
      name: 'file-1.css',
      text: css`
        @layer theme, base, components, utilities;
        @import 'tailwindcss';
        @theme {
          --color-primary: #333;
        }
      `,
    })

    expect(await doc.diagnostics()).toEqual([])
  },
})

defineTest({
  name: '@import functions',
  prepare: async ({ root }) => ({
    client: await createClient({
      server: 'css',
      root,
    }),
  }),
  handle: async ({ client }) => {
    let doc = await client.open({
      lang: 'tailwindcss',
      name: 'file-1.css',
      text: css`
        @import 'tailwindcss' layer(foo) source('../');
        @import 'tailwindcss' theme(inline);
        @import 'tailwindcss' prefix(tw);
        @import 'tailwindcss' layer(foo) source('../') theme(inline) prefix(tw);
      `,
    })

    expect(await doc.diagnostics()).toEqual([])
    expect(await doc.links()).toEqual([
      {
        target: '{workspace:default}/tailwindcss',
        range: {
          start: { line: 0, character: 8 },
          end: { line: 0, character: 21 },
        },
      },
      {
        target: '{workspace:default}/tailwindcss',
        range: {
          start: { line: 1, character: 8 },
          end: { line: 1, character: 21 },
        },
      },
      {
        target: '{workspace:default}/tailwindcss',
        range: {
          start: { line: 2, character: 8 },
          end: { line: 2, character: 21 },
        },
      },
      {
        target: '{workspace:default}/tailwindcss',
        range: {
          start: { line: 3, character: 8 },
          end: { line: 3, character: 21 },
        },
      },
    ])
  },
})

defineTest({
  name: '@reference',
  prepare: async ({ root }) => ({
    client: await createClient({
      server: 'css',
      root,
    }),
  }),
  handle: async ({ client }) => {
    let doc = await client.open({
      lang: 'tailwindcss',
      name: 'file-1.css',
      text: css`
        @reference 'tailwindcss';
      `,
    })

    expect(await doc.diagnostics()).toEqual([])
    expect(await doc.links()).toEqual([
      {
        target: '{workspace:default}/tailwindcss',
        range: {
          start: { line: 0, character: 11 },
          end: { line: 0, character: 24 },
        },
      },
    ])
  },
})

// Legacy
defineTest({
  name: '@screen',
  prepare: async ({ root }) => ({
    client: await createClient({
      server: 'css',
      root,
    }),
  }),
  handle: async ({ client }) => {
    let doc = await client.open({
      lang: 'tailwindcss',
      name: 'file-1.css',
      text: css`
        @screen sm {
          .foo {
            color: red;
          }
        }
      `,
    })

    // No errors
    expect(await doc.diagnostics()).toEqual([])

    // Symbols show up for @custom-variant
    expect(await doc.symbols()).toMatchObject([
      {
        kind: SymbolKind.Module,
        name: '@screen sm',
        location: {
          uri: '{workspace:default}/file-1.css',
          range: {
            start: { line: 0, character: 0 },
            end: { line: 4, character: 1 },
          },
        },
      },
      {
        kind: SymbolKind.Class,
        name: '.foo',
        location: {
          uri: '{workspace:default}/file-1.css',
          range: {
            start: { line: 1, character: 2 },
            end: { line: 3, character: 3 },
          },
        },
      },
    ])
  },
})

defineTest({
  name: '@variants',
  prepare: async ({ root }) => ({
    client: await createClient({
      server: 'css',
      root,
    }),
  }),
  handle: async ({ client }) => {
    let doc = await client.open({
      lang: 'tailwindcss',
      name: 'file-1.css',
      text: css`
        @variants hover, focus {
          .foo {
            color: red;
          }
        }
      `,
    })

    // No errors
    expect(await doc.diagnostics()).toEqual([])

    // Symbols show up for @custom-variant
    expect(await doc.symbols()).toMatchObject([
      {
        kind: SymbolKind.Module,
        name: '@variants hover, focus',
        location: {
          uri: '{workspace:default}/file-1.css',
          range: {
            start: { line: 0, character: 0 },
            end: { line: 4, character: 1 },
          },
        },
      },
      {
        kind: SymbolKind.Class,
        name: '.foo',
        location: {
          uri: '{workspace:default}/file-1.css',
          range: {
            start: { line: 1, character: 2 },
            end: { line: 3, character: 3 },
          },
        },
      },
    ])
  },
})

defineTest({
  name: '@responsive',
  prepare: async ({ root }) => ({
    client: await createClient({
      server: 'css',
      root,
    }),
  }),
  handle: async ({ client }) => {
    let doc = await client.open({
      lang: 'tailwindcss',
      name: 'file-1.css',
      text: css`
        @responsive {
          .foo {
            color: red;
          }
        }
      `,
    })

    // No errors
    expect(await doc.diagnostics()).toEqual([])

    // Symbols show up for @custom-variant
    expect(await doc.symbols()).toMatchObject([
      {
        kind: SymbolKind.Module,
        name: '@responsive ',
        location: {
          uri: '{workspace:default}/file-1.css',
          range: {
            start: { line: 0, character: 0 },
            end: { line: 4, character: 1 },
          },
        },
      },
      {
        kind: SymbolKind.Class,
        name: '.foo',
        location: {
          uri: '{workspace:default}/file-1.css',
          range: {
            start: { line: 1, character: 2 },
            end: { line: 3, character: 3 },
          },
        },
      },
    ])
  },
})

defineTest({
  name: '@media screen(name)',
  prepare: async ({ root }) => ({
    client: await createClient({
      server: 'css',
      root,
    }),
  }),
  handle: async ({ client }) => {
    let doc = await client.open({
      lang: 'tailwindcss',
      name: 'file-1.css',
      text: css`
        @media screen(sm) {
          .foo {
            color: red;
          }
        }
      `,
    })

    // No errors
    expect(await doc.diagnostics()).toEqual([])

    // Symbols show up for @custom-variant
    expect(await doc.symbols()).toMatchObject([
      {
        kind: SymbolKind.Module,
        name: '@media screen(sm)',
        location: {
          uri: '{workspace:default}/file-1.css',
          range: {
            start: { line: 0, character: 0 },
            end: { line: 4, character: 1 },
          },
        },
      },
      {
        kind: SymbolKind.Class,
        name: '.foo',
        location: {
          uri: '{workspace:default}/file-1.css',
          range: {
            start: { line: 1, character: 2 },
            end: { line: 3, character: 3 },
          },
        },
      },
    ])
  },
})

defineTest({
  name: '@layer',
  prepare: async ({ root }) => ({
    client: await createClient({
      server: 'css',
      root,
    }),
  }),
  handle: async ({ client }) => {
    let doc = await client.open({
      lang: 'tailwindcss',
      name: 'file-1.css',
      text: css`
        @layer base {
          .foo {
            color: red;
          }
        }
        @layer utilities {
          .bar {
            color: red;
          }
        }
      `,
    })

    // No errors
    expect(await doc.diagnostics()).toEqual([])

    // Symbols show up for @custom-variant
    expect(await doc.symbols()).toMatchObject([
      {
        kind: SymbolKind.Module,
        name: '@layer base',
        location: {
          uri: '{workspace:default}/file-1.css',
          range: {
            start: { line: 0, character: 0 },
            end: { line: 4, character: 1 },
          },
        },
      },
      {
        kind: SymbolKind.Class,
        name: '.foo',
        location: {
          uri: '{workspace:default}/file-1.css',
          range: {
            start: { line: 1, character: 2 },
            end: { line: 3, character: 3 },
          },
        },
      },
      {
        kind: SymbolKind.Module,
        name: '@layer utilities',
        location: {
          uri: '{workspace:default}/file-1.css',
          range: {
            start: { line: 5, character: 0 },
            end: { line: 9, character: 1 },
          },
        },
      },
      {
        kind: SymbolKind.Class,
        name: '.bar',
        location: {
          uri: '{workspace:default}/file-1.css',
          range: {
            start: { line: 6, character: 2 },
            end: { line: 8, character: 3 },
          },
        },
      },
    ])
  },
})

defineTest({
  name: 'theme(keypath) + config(keypath)',
  prepare: async ({ root }) => ({
    client: await createClient({
      server: 'css',
      root,
    }),
  }),
  handle: async ({ client }) => {
    let doc = await client.open({
      lang: 'tailwindcss',
      name: 'file-1.css',
      text: css`
        .foo {
          width: calc(1rem * theme(colors.red[500]));
          height: calc(1rem * config(screens.mobile.[sm]));
        }
      `,
    })

    expect(await doc.diagnostics()).toEqual([])
  },
})
