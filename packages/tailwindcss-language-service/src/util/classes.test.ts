import { expect, test } from 'vitest'
import { type ClassMatch, type ClassRegexFilter, customClassesIn } from './classes'

interface TestRecord {
  name: string
  text: string
  cursor: number | null
  filters: ClassRegexFilter[]
  expected: ClassMatch[]
}

let table: TestRecord[] = [
  {
    name: 'empty',
    text: 'test ',
    cursor: 0,
    filters: [],
    expected: [],
  },

  // Container regex only
  {
    name: 'simple (single, matches: yes)',
    text: 'test ""',
    cursor: 5,
    filters: [['test (\\S*)']],
    expected: [{ classList: '', range: [5, 7] }],
  },

  {
    name: 'simple (single, matches: no)',
    text: 'tron ""',
    cursor: 5,
    filters: [['test (\\S*)']],
    expected: [],
  },

  {
    name: 'simple (multiple, matches: yes)',
    text: 'tron ""',
    cursor: 5,
    filters: [['test (\\S*)'], ['tron (\\S*)']],
    expected: [{ classList: '', range: [5, 7] }],
  },

  {
    name: 'simple (multiple, matches: no)',
    text: 'nope ""',
    cursor: 5,
    filters: [['test (\\S*)'], ['tron (\\S*)']],
    expected: [],
  },

  // Container + class regex
  {
    name: 'nested (single, matches: yes)',
    text: 'test ""',
    cursor: 6,
    filters: [['test (\\S*)', '"([^"]*)"']],
    expected: [{ classList: '', range: [6, 6] }],
  },

  {
    name: 'nested (single, matches: no)',
    text: 'tron ""',
    cursor: 6,
    filters: [['test (\\S*)', '"([^"]*)"']],
    expected: [],
  },

  {
    name: 'nested (multiple, matches: yes)',
    text: 'tron ""',
    cursor: 6,
    filters: [
      ['test (\\S*)', '"([^"]*)"'],
      ['tron (\\S*)', '"([^"]*)"'],
    ],
    expected: [{ classList: '', range: [6, 6] }],
  },

  {
    name: 'nested (multiple, matches: no)',
    text: 'nope ""',
    cursor: 6,
    filters: [
      ['test (\\S*)', '"([^"]*)"'],
      ['tron (\\S*)', '"([^"]*)"'],
    ],
    expected: [],
  },

  // Cursor position validation
  {
    name: 'cursor, container: inside #1',
    text: `<div class="text-" /> <div class="bg-" />`,
    cursor: 17,
    filters: [['class="([^"]*)"']],
    expected: [{ classList: 'text-', range: [12, 17] }],
  },

  {
    name: 'cursor, container: inside #2',
    text: `<div class="text-" /> <div class="bg-" />`,
    cursor: 37,
    filters: [['class="([^"]*)"']],
    expected: [{ classList: 'bg-', range: [34, 37] }],
  },

  {
    name: 'cursor, container: outside',
    text: `<div class="text-" /> <div class="bg-" />`,
    cursor: 11,
    filters: [['class="([^"]*)"']],
    expected: [],
  },

  {
    name: 'cursor, container: inside #1, class: inside #1',
    text: `<div class={clsx("text-", "decoration-")} /> <div class={clsx("bg-")} />`,
    cursor: 23,
    filters: [['clsx\\(([^)]*)\\)', '"([^"]*)"']],
    expected: [{ classList: 'text-', range: [18, 23] }],
  },

  {
    name: 'cursor, container: inside #1, class: inside #2',
    text: `<div class={clsx("text-", "decoration-")} /> <div class={clsx("bg-")} />`,
    cursor: 38,
    filters: [['clsx\\(([^)]*)\\)', '"([^"]*)"']],
    expected: [{ classList: 'decoration-', range: [27, 38] }],
  },

  {
    name: 'cursor, container: inside #2, class: inside #1',
    text: `<div class={clsx("text-", "decoration-")} /> <div class={clsx("bg-")} />`,
    cursor: 66,
    filters: [['clsx\\(([^)]*)\\)', '"([^"]*)"']],
    expected: [{ classList: 'bg-', range: [63, 66] }],
  },

  {
    name: 'cursor, container: inside #1, class: outside',
    text: `<div class={clsx("text-", "decoration-")} /> <div class={clsx("bg-")} />`,
    cursor: 17,
    filters: [['clsx\\(([^)]*)\\)', '"([^"]*)"']],
    expected: [],
  },

  {
    name: 'cursor, container: inside #2, class: outside',
    text: `<div class={clsx("text-", "decoration-")} /> <div class={clsx("bg-")} />`,
    cursor: 62,
    filters: [['clsx\\(([^)]*)\\)', '"([^"]*)"']],
    expected: [],
  },

  // No cursor = multiple results
  {
    name: 'cursor, container: inside #1',
    text: `<div class="text-" /> <div class="bg-" />`,
    cursor: null,
    filters: [['class="([^"]*)"']],
    expected: [
      { classList: 'text-', range: [12, 17] },
      { classList: 'bg-', range: [34, 37] },
    ],
  },

  // Edge cases
  {
    name: 'container regex matches empty string',
    text: `let _ = ""`,
    cursor: 9,
    filters: [['(?<=")(\\w*)(?=")']],
    expected: [{ classList: '', range: [9, 9] }],
  },

  {
    name: 'container regex matches empty string (no cursor)',
    text: `let _ = ""`,
    cursor: null,
    filters: [['(?<=")(\\w*)(?=")']],
    expected: [{ classList: '', range: [9, 9] }],
  },

  {
    name: 'class regex matches empty string',
    text: `let _ = clsx("")`,
    cursor: 14,
    filters: [['clsx\\(([^)]*)\\)', '(?<=")([^"]*)(?<=")']],
    expected: [{ classList: '', range: [14, 14] }],
  },

  {
    name: 'class regex matches empty string (no cursor)',
    text: `let _ = clsx("")`,
    cursor: null,
    filters: [['clsx\\(([^)]*)\\)', '(?<=")([^"]*)(?<=")']],
    expected: [
      { classList: '', range: [14, 14] },
      { classList: '', range: [15, 15] },
    ],
  },

  {
    name: 'container regex is missing a capture group',
    text: `let _ = ""`,
    cursor: null,
    filters: [['(?<=")\\w*(?=")']],
    expected: [],
  },

  {
    name: 'class regex is missing a capture group',
    text: `let _ = clsx("")`,
    cursor: null,
    filters: [['clsx\\(([^)]*)\\)', '"[^"]*"']],
    expected: [],
  },
]

test.each(table)('customClassesIn: $name', ({ text, cursor, filters, expected }) => {
  expect(Array.from(customClassesIn({ text, filters, cursor }))).toStrictEqual(expected)
})
