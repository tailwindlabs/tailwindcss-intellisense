import { describe, expect, test } from 'vitest'
import { rewriteCss } from './rewriting'
import dedent from 'dedent'

// TODO: Remove once the bundled CSS language service is updated
test('@layer statements are removed', () => {
  let input = [
    //
    '@layer theme, base, components, utilities;',
    '@import "tailwindcss";',
  ]

  let output = [
    //
    '', // wrong
    '@import "tailwindcss" ;',
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
    '@media(℘)        {',
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
  ]

  let output = [
    //
    '.placeholder     {', // wrong
    '  color: red;',
    '}',
    '.placeholder       {', // wrong
    '  color: red;',
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
    '@media (℘)                   {}', // wrong
    '.placeholder     {', // wrong
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
    '.placeholder     {', // wrong
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
