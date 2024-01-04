import { expect, test } from 'vitest'
import { ClassRegexEntry, customClassesIn } from './classes'

interface TestRecord {
  name: string,
  input: string,
  cursor: number,
  regexes: ClassRegexEntry[],
  expected: { classList: string } | null
}

let table: TestRecord[] = [
  {
    name: 'empty',
    input: 'test ',
    cursor: 0,
    regexes: [],
    expected: null
  },

  // Container regex only
  {
    name: 'simple (single, matches: yes)',
    input: 'test ""',
    cursor: 5,
    regexes: [['test (\\S*)']],
    expected: { classList: '' }
  },

  {
    name: 'simple (single, matches: no)',
    input: 'tron ""',
    cursor: 5,
    regexes: [['test (\\S*)']],
    expected: null
  },

  {
    name: 'simple (multiple, matches: yes)',
    input: 'tron ""',
    cursor: 5,
    regexes: [['test (\\S*)'], ['tron (\\S*)']],
    expected: { classList: '' }
  },

  {
    name: 'simple (multiple, matches: no)',
    input: 'nope ""',
    cursor: 5,
    regexes: [['test (\\S*)'], ['tron (\\S*)']],
    expected: null
  },

  // Container + class regex
  {
    name: 'nested (single, matches: yes)',
    input: 'test ""',
    cursor: 6,
    regexes: [['test (\\S*)', '"([^"]*)"']],
    expected: { classList: '' }
  },

  {
    name: 'nested (single, matches: no)',
    input: 'tron ""',
    cursor: 6,
    regexes: [['test (\\S*)', '"([^"]*)"']],
    expected: null
  },

  {
    name: 'nested (multiple, matches: yes)',
    input: 'tron ""',
    cursor: 6,
    regexes: [['test (\\S*)', '"([^"]*)"'], ['tron (\\S*)', '"([^"]*)"']],
    expected: { classList: '' }
  },

  {
    name: 'nested (multiple, matches: no)',
    input: 'nope ""',
    cursor: 6,
    regexes: [['test (\\S*)', '"([^"]*)"'], ['tron (\\S*)', '"([^"]*)"']],
    expected: null
  },

  // Cursor position validation
  {
    name: 'cursor, container: inside #1',
    input: `<div class="text-" /> <div class="bg-" />`,
    cursor: 17,
    regexes: [['class="([^"]*)"']],
    expected: { classList: 'text-' }
  },

  {
    name: 'cursor, container: inside #2',
    input: `<div class="text-" /> <div class="bg-" />`,
    cursor: 37,
    regexes: [['class="([^"]*)"']],
    expected: { classList: 'bg-' }
  },

  {
    name: 'cursor, container: outside',
    input: `<div class="text-" /> <div class="bg-" />`,
    cursor: 11,
    regexes: [['class="([^"]*)"']],
    expected: null
  },

  {
    name: 'cursor, container: inside #1, class: inside #1',
    input: `<div class={clsx("text-", "decoration-")} /> <div class={clsx("bg-")} />`,
    cursor: 23,
    regexes: [['clsx\\(([^)]*)\\)', '"([^"]*)"']],
    expected: { classList: 'text-' }
  },

  {
    name: 'cursor, container: inside #1, class: inside #2',
    input: `<div class={clsx("text-", "decoration-")} /> <div class={clsx("bg-")} />`,
    cursor: 38,
    regexes: [['clsx\\(([^)]*)\\)', '"([^"]*)"']],
    expected: { classList: 'decoration-' }
  },

  {
    name: 'cursor, container: inside #2, class: inside #1',
    input: `<div class={clsx("text-", "decoration-")} /> <div class={clsx("bg-")} />`,
    cursor: 66,
    regexes: [['clsx\\(([^)]*)\\)', '"([^"]*)"']],
    expected: { classList: 'bg-' }
  },

  {
    name: 'cursor, container: inside #1, class: outside',
    input: `<div class={clsx("text-", "decoration-")} /> <div class={clsx("bg-")} />`,
    cursor: 17,
    regexes: [['clsx\\(([^)]*)\\)', '"([^"]*)"']],
    expected: null,
  },

  {
    name: 'cursor, container: inside #2, class: outside',
    input: `<div class={clsx("text-", "decoration-")} /> <div class={clsx("bg-")} />`,
    cursor: 62,
    regexes: [['clsx\\(([^)]*)\\)', '"([^"]*)"']],
    expected: null,
  },

  // Edge cases
  {
    name: 'regex matches empty string',
    input: `let _ = ""`,
    cursor: 9,
    regexes: [['(?<=")(\\w*)(?=")']],
    expected: { classList: '' },
  },
]

test.each(table)('customClassesIn: $name', ({ input, cursor, regexes, expected }) => {
  expect(customClassesIn(input, cursor, regexes)).toStrictEqual(expected)
})
