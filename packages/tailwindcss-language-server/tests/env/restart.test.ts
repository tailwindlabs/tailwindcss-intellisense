import { expect } from 'vitest'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { css, defineTest } from '../../src/testing'
import dedent from 'dedent'
import { createClient } from '../utils/client'

defineTest({
  name: 'The design system is reloaded when the CSS changes ($watcher)',
  fs: {
    'app.css': css`
      @import 'tailwindcss';

      @theme {
        --color-primary: #c0ffee;
      }
    `,
  },
  prepare: async ({ root }) => ({
    client: await createClient({
      root,
      capabilities(caps) {
        caps.workspace!.didChangeWatchedFiles!.dynamicRegistration = false
      },
    }),
  }),
  handle: async ({ root, client }) => {
    let doc = await client.open({
      lang: 'html',
      text: '<div class="text-primary">',
    })

    // <div class="text-primary">
    //             ^
    let hover = await doc.hover({ line: 0, character: 13 })

    expect(hover).toEqual({
      contents: {
        language: 'css',
        value: dedent`
          .text-primary {
            color: var(--color-primary) /* #c0ffee */;
          }
        `,
      },
      range: {
        start: { line: 0, character: 12 },
        end: { line: 0, character: 24 },
      },
    })

    let didReload = new Promise((resolve) => {
      client.conn.onNotification('@/tailwindCSS/projectReloaded', resolve)
    })

    // Update the CSS
    await fs.writeFile(
      path.resolve(root, 'app.css'),
      css`
        @import 'tailwindcss';

        @theme {
          --color-primary: #bada55;
        }
      `,
    )

    await didReload

    // <div class="text-primary">
    //             ^
    let hover2 = await doc.hover({ line: 0, character: 13 })

    expect(hover2).toEqual({
      contents: {
        language: 'css',
        value: dedent`
          .text-primary {
            color: var(--color-primary) /* #bada55 */;
          }
        `,
      },
      range: {
        start: { line: 0, character: 12 },
        end: { line: 0, character: 24 },
      },
    })
  },
})

defineTest({
  options: {
    retry: 3,

    // This test passes on all platforms but it is super flaky
    // The server needs some re-working to ensure everything is awaited
    // properly with respect to messages and server responses
    skip: true,
  },
  name: 'Server is "restarted" when a config file is removed',
  fs: {
    'app.css': css`
      @import 'tailwindcss';

      @theme {
        --color-primary: #c0ffee;
      }
    `,
  },
  prepare: async ({ root }) => ({
    client: await createClient({
      root,
      capabilities(caps) {
        caps.workspace!.didChangeWatchedFiles!.dynamicRegistration = false
      },
    }),
  }),
  handle: async ({ root, client }) => {
    let doc = await client.open({
      lang: 'html',
      text: '<div class="text-primary">',
    })

    // <div class="text-primary">
    //             ^
    let hover = await doc.hover({ line: 0, character: 13 })

    expect(hover).toEqual({
      contents: {
        language: 'css',
        value: dedent`
          .text-primary {
            color: var(--color-primary) /* #c0ffee */;
          }
        `,
      },
      range: {
        start: { line: 0, character: 12 },
        end: { line: 0, character: 24 },
      },
    })

    expect(client.serverCapabilities).not.toEqual([])
    let ids1 = client.serverCapabilities.map((cap) => cap.id)

    // Remove the CSS file
    let didRestart = new Promise((resolve) => {
      client.conn.onNotification('@/tailwindCSS/serverRestarted', resolve)
    })
    await fs.unlink(path.resolve(root, 'app.css'))
    await didRestart

    expect(client.serverCapabilities).not.toEqual([])
    let ids2 = client.serverCapabilities.map((cap) => cap.id)

    // <div class="text-primary">
    //             ^
    let hover2 = await doc.hover({ line: 0, character: 13 })
    expect(hover2).toEqual(null)

    // Re-create the CSS file
    let didRestartAgain = new Promise((resolve) => {
      client.conn.onNotification('@/tailwindCSS/serverRestarted', resolve)
    })
    await fs.writeFile(
      path.resolve(root, 'app.css'),
      css`
        @import 'tailwindcss';
      `,
    )
    await didRestartAgain

    expect(client.serverCapabilities).not.toEqual([])
    let ids3 = client.serverCapabilities.map((cap) => cap.id)

    await new Promise((resolve) => setTimeout(resolve, 500))

    // <div class="text-primary">
    //             ^
    let hover3 = await doc.hover({ line: 0, character: 13 })
    expect(hover3).toEqual(null)

    expect(ids1).not.toContainEqual(expect.toBeOneOf(ids2))
    expect(ids1).not.toContainEqual(expect.toBeOneOf(ids3))

    expect(ids2).not.toContainEqual(expect.toBeOneOf(ids1))
    expect(ids2).not.toContainEqual(expect.toBeOneOf(ids3))

    expect(ids3).not.toContainEqual(expect.toBeOneOf(ids1))
    expect(ids3).not.toContainEqual(expect.toBeOneOf(ids2))
  },
})
