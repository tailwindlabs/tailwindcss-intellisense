import { test } from 'vitest'
import dedent, { type Dedent } from 'dedent'
import { loadGrammar } from './utils'

const css: Dedent = dedent

let grammar = await loadGrammar()

test('wip', async ({ expect }) => {
  let result = await grammar.tokenize(css`
    @theme {
      --color: red;
    }
  `)

  expect(result.toString()).toMatchInlineSnapshot(`
    "
    @theme {
    ^               source.css.tailwind keyword.control.at-rule.theme.tailwind punctuation.definition.keyword.css
     ^^^^^          source.css.tailwind keyword.control.at-rule.theme.tailwind
          ^^^       source.css.tailwind

      --color: red;
    ^^              source.css.tailwind
      ^^^^^^^       source.css.tailwind meta.property-name.css
             ^      source.css.tailwind punctuation.separator.key-value.css
              ^     source.css.tailwind
               ^^^  source.css.tailwind meta.property-value.css support.constant.color.w3c-standard-color-name.css
                  ^ source.css.tailwind punctuation.terminator.rule.css

    }
    ^^              source.css.tailwind

    "
  `)
})

test('plugins', async ({ expect }) => {
  let result = await grammar.tokenize(css`
    @plugin "foo";
    @plugin "foo";
  `)

  expect(result.toString()).toMatchInlineSnapshot(`
    "
    @plugin "foo";
    ^              source.css.tailwind keyword.control.at-rule.plugin.tailwind punctuation.definition.keyword.tailwind
     ^^^^^^        source.css.tailwind keyword.control.at-rule.plugin.tailwind
           ^       source.css.tailwind
            ^      source.css.tailwind string.quoted.double.css punctuation.definition.string.begin.css
             ^^^   source.css.tailwind string.quoted.double.css
                ^  source.css.tailwind string.quoted.double.css punctuation.definition.string.end.css
                 ^ source.css.tailwind

    @plugin "foo";
    ^              source.css.tailwind keyword.control.at-rule.plugin.tailwind punctuation.definition.keyword.tailwind
     ^^^^^^        source.css.tailwind keyword.control.at-rule.plugin.tailwind
           ^       source.css.tailwind
            ^      source.css.tailwind string.quoted.double.css punctuation.definition.string.begin.css
             ^^^   source.css.tailwind string.quoted.double.css
                ^  source.css.tailwind string.quoted.double.css punctuation.definition.string.end.css
                 ^ source.css.tailwind

    "
  `)
})

test('plugins with options', async ({ expect }) => {
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

  expect(result.toString()).toMatchInlineSnapshot(`
    "
    @import 'tailwindcss';
    ^                      source.css.tailwind meta.at-rule.import.css keyword.control.at-rule.import.css punctuation.definition.keyword.css
     ^^^^^^                source.css.tailwind meta.at-rule.import.css keyword.control.at-rule.import.css
           ^               source.css.tailwind meta.at-rule.import.css
            ^              source.css.tailwind meta.at-rule.import.css string.quoted.single.css punctuation.definition.string.begin.css
             ^^^^^^^^^^^   source.css.tailwind meta.at-rule.import.css string.quoted.single.css
                        ^  source.css.tailwind meta.at-rule.import.css string.quoted.single.css punctuation.definition.string.end.css
                         ^ source.css.tailwind meta.at-rule.import.css punctuation.terminator.rule.css

    @plugin "testing" {
    ^                      source.css.tailwind keyword.control.at-rule.plugin.tailwind punctuation.definition.keyword.tailwind
     ^^^^^^                source.css.tailwind keyword.control.at-rule.plugin.tailwind
           ^               source.css.tailwind
            ^              source.css.tailwind string.quoted.double.css punctuation.definition.string.begin.css
             ^^^^^^^       source.css.tailwind string.quoted.double.css
                    ^      source.css.tailwind string.quoted.double.css punctuation.definition.string.end.css
                     ^     source.css.tailwind
                      ^    source.css.tailwind meta.at-rule.plugin.body.tailwind punctuation.section.plugin.begin.bracket.curly.tailwind

      color: red;
    ^^                     source.css.tailwind meta.at-rule.plugin.body.tailwind
      ^^^^^                source.css.tailwind meta.at-rule.plugin.body.tailwind support.type.property-name.css
           ^               source.css.tailwind meta.at-rule.plugin.body.tailwind punctuation.separator.key-value.css
            ^              source.css.tailwind meta.at-rule.plugin.body.tailwind
             ^^^           source.css.tailwind meta.at-rule.plugin.body.tailwind meta.property-value.css support.constant.color.w3c-standard-color-name.css
                ^          source.css.tailwind meta.at-rule.plugin.body.tailwind punctuation.terminator.rule.css

    }
    ^                      source.css.tailwind meta.at-rule.plugin.body.tailwind punctuation.section.plugin.end.bracket.curly.tailwind


    ^                      source.css.tailwind

    html,
    ^^^^                   source.css.tailwind meta.selector.css entity.name.tag.css
        ^                  source.css.tailwind meta.selector.css punctuation.separator.list.comma.css

    body {
    ^^^^                   source.css.tailwind meta.selector.css entity.name.tag.css
        ^                  source.css.tailwind
         ^                 source.css.tailwind meta.property-list.css punctuation.section.property-list.begin.bracket.curly.css

      color: red;
    ^^                     source.css.tailwind meta.property-list.css
      ^^^^^                source.css.tailwind meta.property-list.css meta.property-name.css support.type.property-name.css
           ^               source.css.tailwind meta.property-list.css punctuation.separator.key-value.css
            ^              source.css.tailwind meta.property-list.css
             ^^^           source.css.tailwind meta.property-list.css meta.property-value.css support.constant.color.w3c-standard-color-name.css
                ^          source.css.tailwind meta.property-list.css punctuation.terminator.rule.css

    }
    ^                      source.css.tailwind meta.property-list.css punctuation.section.property-list.end.bracket.curly.css

    "
  `)
})
