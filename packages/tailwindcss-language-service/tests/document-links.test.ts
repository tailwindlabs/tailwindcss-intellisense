import { test, expect, describe } from 'vitest'
import { ClientOptions, createClient } from './utils/client'
import { css, range } from './utils/utils'
import { DocumentLink } from 'vscode-languageserver'

interface DocumentLinkFixture {
  name: string
  client?: ClientOptions
  lang?: string
  text: string
  expected: DocumentLink[]
}

describe('v4', async () => {
  let client = await createClient({
    config: {
      kind: 'css',
      content: css`
        /* */
      `,
    },
  })

  function runTest({
    client: clientOpts,
    name,
    lang = 'html',
    text,
    expected,
  }: DocumentLinkFixture) {
    test(name, async () => {
      let testClient = clientOpts ? await createClient(clientOpts) : client
      let doc = await testClient.open({ lang, text })
      expect(await doc.documentLinks()).toEqual(expected)
    })
  }

  runTest({
    name: 'config: file exists',
    lang: 'css',
    text: css`
      @config "tailwind.config.js";
    `,
    expected: [
      {
        target: 'file:///projects/root/tailwind.config.js',
        range: range(0, 8, 0, 28),
      },
    ],
  })

  runTest({
    name: 'config: file does not exist',
    lang: 'css',
    text: css`
      @config "does-not-exist.js";
    `,
    expected: [
      {
        target: 'file:///projects/root/does-not-exist.js',
        range: range(0, 8, 0, 27),
      },
    ],
  })

  runTest({
    name: 'plugin: file exists',
    lang: 'css',
    text: css`
      @plugin "plugin.js";
    `,
    expected: [
      {
        target: 'file:///projects/root/plugin.js',
        range: range(0, 8, 0, 19),
      },
    ],
  })

  runTest({
    name: 'plugin: file does not exist',
    lang: 'css',
    text: css`
      @plugin "does-not-exist.js";
    `,
    expected: [
      {
        target: 'file:///projects/root/does-not-exist.js',
        range: range(0, 8, 0, 27),
      },
    ],
  })

  runTest({
    name: 'source: file exists',
    lang: 'css',
    text: css`
      @source "index.html";
    `,
    expected: [
      {
        target: 'file:///projects/root/index.html',
        range: range(0, 8, 0, 20),
      },
    ],
  })

  runTest({
    name: 'source: file does not exist',
    lang: 'css',
    text: css`
      @source "does-not-exist.html";
    `,
    expected: [
      {
        target: 'file:///projects/root/does-not-exist.html',
        range: range(0, 8, 0, 29),
      },
    ],
  })

  runTest({
    name: 'source not: file exists',
    lang: 'css',
    text: css`
      @source not "index.html";
    `,
    expected: [
      {
        target: 'file:///projects/root/index.html',
        range: range(0, 12, 0, 24),
      },
    ],
  })

  runTest({
    name: 'source not: file does not exist',
    lang: 'css',
    text: css`
      @source not "does-not-exist.html";
    `,
    expected: [
      {
        target: 'file:///projects/root/does-not-exist.html',
        range: range(0, 12, 0, 33),
      },
    ],
  })

  runTest({
    name: '@source inline(…)',
    lang: 'css',
    text: css`
      @source inline("m-{1,2,3}");
    `,
    expected: [],
  })

  runTest({
    name: '@source not inline(…)',
    lang: 'css',
    text: css`
      @source not inline("m-{1,2,3}");
    `,
    expected: [],
  })

  runTest({
    name: 'Directories in source(…) show links',
    lang: 'css',
    text: css`
      @import 'tailwindcss' source('../../');
      @tailwind utilities source("../../");
    `,
    expected: [
      {
        target: 'file:///',
        range: range(0, 29, 0, 37),
      },
      {
        target: 'file:///',
        range: range(1, 27, 1, 35),
      },
    ],
  })

  runTest({
    name: 'Globs in source(…) do not show links',
    lang: 'css',
    text: css`
      @import 'tailwindcss' source('../{a,b,c}');
      @tailwind utilities source("../{a,b,c}");
    `,
    expected: [],
  })

  runTest({
    name: 'Windows paths in source(…) do not show links',
    lang: 'css',
    text: css`
      @import 'tailwindcss' source('..\foo\bar');
      @tailwind utilities source("..\foo\bar");

      @import 'tailwindcss' source('C:\foo\bar');
      @tailwind utilities source("C:\foo\bar");

      @import 'tailwindcss' source('C:foo');
      @tailwind utilities source("C:bar");
    `,
    expected: [],
  })
})
