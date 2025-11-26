import { test } from 'vitest'
import dedent, { type Dedent } from 'dedent'
import { loadGrammar } from './utils'

const css: Dedent = dedent

let grammar = await loadGrammar()

test('@theme', async ({ expect }) => {
  let result = await grammar.tokenize(css`
    @theme {
      --color: red;
    }
    @theme static {
      --color: red;
    }
    @theme inline deprecated {
      --color: red;
    }
    @theme prefix(tw) inline {
      --color: red;
    }

    @theme {
      --spacing: initial;
      --color-*: initial;
      --animate-pulse: 1s pulse infinite;

      @keyframes pulse {
        0%,
        100% {
          opacity: 0;
        }
        50% {
          opacity: 1;
        }
      }
    }

    @theme {
      /** Comment 0 */

      /** Comment 1 */
      --color-1: red;

      /** Comment 2 */
      --color-2: green;

      /** Comment 3 */
      --color-2: blue;

      /** Comment 4 */
    }
  `)

  expect(result.toString()).toMatchSnapshot()
})

test('@import', async ({ expect }) => {
  let result = await grammar.tokenize(css`
    @import './test.css';

    @import './test.css' prefix(tw);
    @import './test.css' layer(utilities) prefix(tw);

    @import './test.css' source(none);
    @import './test.css' source('./foo');
    @import './test.css' layer(utilities) source('./foo');

    @import './test.css' theme(static);
    @import './test.css' theme(static default inline);
    @import './test.css' theme(reference deprecated);
    @import './test.css' theme(prefix(tw) reference);
    @import './test.css' theme(default invalid reference);

    @reference './test.css';

    @reference './test.css' prefix(tw);
    @reference './test.css' layer(utilities) prefix(tw);

    @reference './test.css' source(none);
    @reference './test.css' source('./foo');
    @reference './test.css' layer(utilities) source('./foo');

    @reference './test.css' theme(static);
    @reference './test.css' theme(static default inline);
    @reference './test.css' theme(reference deprecated);
    @reference './test.css' theme(prefix(tw) reference);
    @reference './test.css' theme(default invalid reference);
  `)

  expect(result.toString()).toMatchSnapshot()
})

test('@plugin statement', async ({ expect }) => {
  let result = await grammar.tokenize(css`
    @plugin "./foo";
    @plugin "./bar";
  `)

  expect(result.toString()).toMatchSnapshot()
})

test('@plugin with options', async ({ expect }) => {
  let result = await grammar.tokenize(css`
    @import 'tailwindcss';
    @plugin "testing" {
      color: red;
    }

    html,
    body {
      color: red;
    }
  `)

  expect(result.toString()).toMatchSnapshot()
})

test('@config statement', async ({ expect }) => {
  let result = await grammar.tokenize(css`
    @config "./foo";
    @config "./bar";
  `)

  expect(result.toString()).toMatchSnapshot()
})

test('@tailwind', async ({ expect }) => {
  let result = await grammar.tokenize(css`
    @tailwind base;
    @tailwind components;
    @tailwind utilities;
    @tailwind utilities source(none);
    @tailwind utilities source("./**/*");
    @tailwind screens;
    @tailwind variants;
    @tailwind unknown;
  `)

  expect(result.toString()).toMatchSnapshot()
})

test('@source', async ({ expect }) => {
  let result = await grammar.tokenize(css`
    @source "./dir";
    @source "./file.ts";
    @source "./dir/**/file-{a,b}.ts";
    @source not "./dir";
    @source not "./file.ts";
    @source not "./dir/**/file-{a,b}.ts";

    @source inline("flex");
    @source inline("flex bg-red-{50,{100..900..100},950}");
    @source not inline("flex");
    @source not inline("flex bg-red-{50,{100..900..100},950}");
  `)

  expect(result.toString()).toMatchSnapshot()
})

test('@layer', async ({ expect }) => {
  let result = await grammar.tokenize(css`
    @layer theme, base, components, utilities;
    @layer utilities {
      .custom {
        width: 12px;
      }
    }
  `)

  expect(result.toString()).toMatchSnapshot()
})

test('@utility', async ({ expect }) => {
  let result = await grammar.tokenize(css`
    @utility custom {
      width: 12px;
    }

    @utility functional-* {
      width: calc(--value(number) * 1px);
    }

    @utility tab-* {
      tab-size: --value(--);
      font-size: 12px;
    }

    @utility tab-* {
      tab-size: --value(--tab-size);
      font-size: 12px;
    }

    @utility tab-* {
      tab-size: --value(--tab-size-*);
      font-size: 12px;
    }

    @utility foo {
      @apply flex;
    }

    @utility foo {
      & {
        color: red;
      }
    }
  `)

  expect(result.toString()).toMatchSnapshot()
})

test('--value(…)', async ({ expect }) => {
  let result = await grammar.tokenize(css`
    @utility functional-* {
      width: --value(
        --size,
        'literal',
        integer,
        number,
        percentage,
        ratio,
        [integer],
        [number],
        [percentage],
        [ratio]
      );

      height: --modifier(
        --size,
        'literal',
        integer,
        number,
        percentage,
        ratio,
        [integer],
        [number],
        [percentage],
        [ratio]
      );

      color: --alpha(--value([color]) / --modifier(number));
    }
  `)

  expect(result.toString()).toMatchSnapshot()
})

test('@variant', async ({ expect }) => {
  let result = await grammar.tokenize(css`
    @variant dark {
      .foo {
        color: white;
      }
    }

    .bar {
      @variant dark {
        color: white;
      }
    }
  `)

  expect(result.toString()).toMatchSnapshot()
})

test('@custom-variant', async ({ expect }) => {
  let result = await grammar.tokenize(css`
    @custom-variant dark (&:is(.dark, .dark *));
    @custom-variant dark {
      &:is(.dark, .dark *) {
        @slot;
      }
    }
    @custom-variant around {
      color: '';
      &::before,
      &::after {
        @slot;
      }
    }
  `)

  expect(result.toString()).toMatchSnapshot()
})

test('legacy: @responsive', async ({ expect }) => {
  let result = await grammar.tokenize(css`
    @responsive {
      .foo {
        color: red;
      }
    }
  `)

  expect(result.toString()).toMatchSnapshot()
})

test('legacy: @variants', async ({ expect }) => {
  let result = await grammar.tokenize(css`
    @variants hover, focus {
      .foo {
        color: red;
      }
    }
  `)

  expect(result.toString()).toMatchSnapshot()
})

test('legacy: @screen', async ({ expect }) => {
  let result = await grammar.tokenize(css`
    @screen sm {
      .foo {
        color: red;
      }
    }
  `)

  expect(result.toString()).toMatchSnapshot()
})
