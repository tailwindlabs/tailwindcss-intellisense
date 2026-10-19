import { describe, expect, test } from 'vitest'
import { rewriteCss } from './rewriting'

// https://github.com/tailwindlabs/tailwindcss-intellisense/issues/1457
test('@layer statements inside comments do not break', () => {
  let input = [
    //
    '/* @layer',
    '*/',
    '@import "./path/to/a/file.css";',
    '',
    '@source "./**/*.{ts,tsx}";',
  ]

  let output = [
    //
    '/* @layer',
    '*/',
    '@import "./path/to/a/file.css" ;', // wrong
    '',
    '@source "./**/*.{ts,tsx}";',
  ]

  expect(rewriteCss(input.join('\n'))).toBe(output.join('\n'))
})

test('@layer blocks', () => {
  let input = [
    //
    '@layer utilities {',
    '  .foo {',
    '    color: red;',
    '  }',
    '}',
  ]

  let output = [
    //
    '@layer utilities {',
    '  .foo {',
    '    color: red;',
    '  }',
    '}',
  ]

  expect(rewriteCss(input.join('\n'))).toBe(output.join('\n'))
})

test('@utility', () => {
  let input = [
    //
    '@utility foo {',
    '  color: red;',
    '}',
    '@utility foo-* {',
    '  color: red;',
    '}',
    '@utility bar-* {',
    '  color: --value(--font-*-line-height);',
    '}',
  ]

  let output = [
    //
    '._______     {',
    '  color: red;',
    '}',
    '._______       {',
    '  color: red;',
    '}',
    '._______       {',
    '  color: --value(--font-_-line-height);',
    '}',
  ]

  expect(rewriteCss(input.join('\n'))).toBe(output.join('\n'))
})

test('@theme', () => {
  let input = [
    //
    '@theme {',
    '  --color: red;',
    '  --*: initial;',
    '  --text*: initial;',
    '  --font-*: initial;',
    '  --font-weight-*: initial;',
    '}',
    '@theme inline reference static default {',
    '  --color: red;',
    '  --*: initial;',
    '  --text*: initial;',
    '  --font-*: initial;',
    '  --font-weight-*: initial;',
    '}',
  ]

  let output = [
    //
    '._____ {',
    '  --color: red;',
    '  --_: initial;',
    '  --text_: initial;',
    '  --font-_: initial;',
    '  --font-weight-_: initial;',
    '}',
    '._____                                 {',
    '  --color: red;',
    '  --_: initial;',
    '  --text_: initial;',
    '  --font-_: initial;',
    '  --font-weight-_: initial;',
    '}',
  ]

  expect(rewriteCss(input.join('\n'))).toBe(output.join('\n'))
})

test('@custom-variant', () => {
  let input = [
    //
    '@custom-variant foo (&:hover);',
    '@custom-variant foo {',
    '  &:hover {',
    '    @slot;',
    '  }',
    '}',
  ]

  let output = [
    //
    '@media(℘)                   {}',
    '.______________     {',
    '  &:hover {',
    '    @slot;',
    '  }',
    '}',
  ]

  expect(rewriteCss(input.join('\n'))).toBe(output.join('\n'))
})

test('@variant', () => {
  let input = [
    //
    '@variant foo {',
    '  &:hover {',
    '    @slot;',
    '  }',
    '}',
  ]

  let output = [
    //
    '._______     {',
    '  &:hover {',
    '    @slot;',
    '  }',
    '}',
  ]

  expect(rewriteCss(input.join('\n'))).toBe(output.join('\n'))
})

test('@reference', () => {
  let input = [
    //
    '@reference "./app.css";',
    '@reference "./app.css" source(none);',
  ]

  let output = [
    //
    '@import    "./app.css" ;', // wrong
    '@import    "./app.css" ;', // wrong
  ]

  expect(rewriteCss(input.join('\n'))).toBe(output.join('\n'))
})

test('@import', () => {
  let input = [
    //
    '@import "tailwindcss";',
    '@import "tailwindcss" source(none);',
    '@import "tailwindcss/utilities" layer(utilities);',
    '@import "tailwindcss/utilities" layer(utilities) source(none);',
    '@import "tailwindcss/utilities" layer(utilities) theme(inline);',
    '@import "tailwindcss/utilities" layer(utilities) prefix(tw);',
    '@import "tailwindcss/utilities" layer(utilities) source(none) theme(inline) prefix(tw);',
  ]

  let output = [
    //
    '@import "tailwindcss" ;', // wrong
    '@import "tailwindcss" ;', // wrong
    '@import "tailwindcss/utilities" layer(utilities);',
    '@import "tailwindcss/utilities" layer(utilities) ;', // wrong
    '@import "tailwindcss/utilities" layer(utilities) ;', // wrong
    '@import "tailwindcss/utilities" layer(utilities) ;', // wrong
    '@import "tailwindcss/utilities" layer(utilities) ;', // wrong
  ]

  expect(rewriteCss(input.join('\n'))).toBe(output.join('\n'))
})

test('--value(namespace) / --modifier(namespace)', () => {
  let input = [
    //
    '.foo {',
    '  color: --value(--color-*)',
    '  background: --modifier(--color-*)',
    '  z-index: --value([*])',
    '  z-index: --modifier([*])',
    '}',
  ]

  let output = [
    //
    '.foo {',
    '  color: --value(--color-_)',
    '  background: --modifier(--color-_)',
    '  z-index: --value([_])',
    '  z-index: --modifier([_])',
    '}',
  ]

  expect(rewriteCss(input.join('\n'))).toBe(output.join('\n'))
})

describe('v3', () => {
  test('@screen', () => {
    let input = [
      //
      '@screen sm {',
      '  .foo {',
      '    color: red;',
      '  }',
      '}',
    ]

    let output = [
      //
      '@media(℘)  {',
      '  .foo {',
      '    color: red;',
      '  }',
      '}',
    ]

    expect(rewriteCss(input.join('\n'))).toBe(output.join('\n'))
  })

  test('@variants', () => {
    let input = [
      //
      '@variants focus, hover {',
      '  .foo {',
      '    color: red;',
      '  }',
      '}',
    ]

    let output = [
      //
      '@media(℘)              {',
      '  .foo {',
      '    color: red;',
      '  }',
      '}',
    ]

    expect(rewriteCss(input.join('\n'))).toBe(output.join('\n'))
  })

  test('@responsive', () => {
    let input = [
      //
      '@responsive {',
      '  .foo {',
      '    color: red;',
      '  }',
      '}',
    ]

    let output = [
      //
      '@media(℘) {', // todo wrong
      '  .foo {',
      '    color: red;',
      '  }',
      '}',
    ]

    expect(rewriteCss(input.join('\n'))).toBe(output.join('\n'))
  })

  test('@responsive', () => {
    let input = [
      //
      '@responsive {',
      '  .foo {',
      '    color: red;',
      '  }',
      '}',
    ]

    let output = [
      //
      '@media(℘) {', // incorrect
      '  .foo {',
      '    color: red;',
      '  }',
      '}',
    ]

    expect(rewriteCss(input.join('\n'))).toBe(output.join('\n'))
  })

  test('@media screen(…)', () => {
    let input = [
      //
      '@media screen(sm) {',
      '  .foo {',
      '    color: red;',
      '  }',
      '}',
    ]

    let output = [
      //
      '@media (℘)        {',
      '  .foo {',
      '    color: red;',
      '  }',
      '}',
    ]

    expect(rewriteCss(input.join('\n'))).toBe(output.join('\n'))
  })

  test('theme(keypath) + config(keypath)', () => {
    let input = [
      //
      '.foo {',
      '  width: calc(1rem * theme(colors.red[500]));',
      '  height: calc(1rem * config(screens.mobile.[sm]));',
      '}',
    ]

    let output = [
      //
      '.foo {',
      '  width: calc(1rem * theme(colors_red_500_));',
      '  height: calc(1rem * config(screens_mobile__sm_));',
      '}',
    ]

    expect(rewriteCss(input.join('\n'))).toBe(output.join('\n'))
  })
})

// https://github.com/tailwindlabs/tailwindcss-intellisense/issues/1615
test('at-rules mentioned inside comments are not rewritten', () => {
  let input = [
    //
    '/**',
    ' * This comment mentions the @variant at-rule in prose.',
    ' */',
    '@theme {',
    '  --color-brand: #000;',
    '}',
    '/* @screen, @variants, @responsive, @utility and @custom-variant foo; */',
    '/* @media screen(sm) @reference "./app.css" --font-*/',
    '.a {',
    '  /* A label */',
    '  color: red;',
    '}',
  ]

  let output = [
    //
    '/**',
    ' * This comment mentions the @variant at-rule in prose.',
    ' */',
    '._____ {',
    '  --color-brand: #000;',
    '}',
    '/* @screen, @variants, @responsive, @utility and @custom-variant foo; */',
    '/* @media screen(sm) @reference "./app.css" --font-*/',
    '.a {',
    '  /* A label */',
    '  color: red;',
    '}',
  ]

  expect(rewriteCss(input.join('\n'))).toBe(output.join('\n'))
})

test('at-rules following a comment that mentions them are still rewritten', () => {
  let input = [
    //
    '/* @variant */',
    '@variant foo {',
    '  @slot;',
    '}',
    '/* "@utility" */ @utility bar /* note */ {',
    '  color: red;',
    '}',
    '.b { content: "/* @variant"; }',
    '@variant baz {',
    '  @slot;',
    '}',
  ]

  let output = [
    //
    '/* @variant */',
    '._______     {',
    '  @slot;',
    '}',
    '/* "@utility" */ ._______                {',
    '  color: red;',
    '}',
    '.b { content: "/* @variant"; }',
    '._______     {',
    '  @slot;',
    '}',
  ]

  expect(rewriteCss(input.join('\n'))).toBe(output.join('\n'))
})

test('rewritten at-rules preserve line breaks in their preludes', () => {
  let input = [
    //
    '@utility foo',
    '{',
    '  color: red;',
    '}',
    '@custom-variant bar',
    '  (&:hover);',
    '@variant baz',
    '{',
    '  @slot;',
    '}',
  ]

  let output = [
    //
    '._______',
    '{',
    '  color: red;',
    '}',
    '@media(℘)',
    '          {}',
    '._______',
    '{',
    '  @slot;',
    '}',
  ]

  expect(rewriteCss(input.join('\n'))).toBe(output.join('\n'))
})

test('comment markers inside unquoted urls do not start comments', () => {
  let input = [
    //
    '.a { background: url(/icons/*.svg); }',
    '@media screen(sm) { .b { color: red; } }',
    '.c { background: URL( "/*" ) /* @variant */; }',
    '@variant foo {',
    '  @slot;',
    '}',
  ]

  let output = [
    //
    '.a { background: url(/icons/*.svg); }',
    '@media (℘)        { .b { color: red; } }',
    '.c { background: URL( "/*" ) /* @variant */; }',
    '._______     {',
    '  @slot;',
    '}',
  ]

  expect(rewriteCss(input.join('\n'))).toBe(output.join('\n'))
})

test('escaped quotes outside of strings do not start strings', () => {
  let input = [
    //
    '.foo\\"bar {} /* @variant */',
    '@theme { --color-brand: #000; }',
  ]

  let output = [
    //
    '.foo\\"bar {} /* @variant */',
    '._____ { --color-brand: #000; }',
  ]

  expect(rewriteCss(input.join('\n'))).toBe(output.join('\n'))
})

test('multiline @custom-variant with the semicolon on its own line keeps columns', () => {
  let input = [
    //
    '@custom-variant foo (&:hover)',
    ';.a { color: red; }',
  ]

  let output = [
    //
    '@media(℘){',
    '}.a { color: red; }',
  ]

  expect(rewriteCss(input.join('\n'))).toBe(output.join('\n'))
})
