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
