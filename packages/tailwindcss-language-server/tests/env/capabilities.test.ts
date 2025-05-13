import { expect } from 'vitest'
import { defineTest, js } from '../../src/testing'
import { createClient } from '../utils/client'
import * as fs from 'node:fs/promises'

defineTest({
  name: 'Changing the separator registers new trigger characters',
  fs: {
    'tailwind.config.js': js`
      module.exports = {
        separator: ':',
      }
    `,
  },
  prepare: async ({ root }) => ({ client: await createClient({ root }) }),
  handle: async ({ root, client }) => {
    // Initially don't have any registered capabilities because dynamic
    // registration is delayed until after project initialization
    expect(client.serverCapabilities).toEqual([])

    // We open a document so a project gets initialized
    await client.open({
      lang: 'html',
      text: '<div class="bg-[#000]/25 hover:">',
    })

    // And now capabilities are registered
    expect(client.serverCapabilities).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          method: 'textDocument/hover',
        }),

        expect.objectContaining({
          method: 'textDocument/completion',
          registerOptions: {
            documentSelector: null,
            resolveProvider: true,
            triggerCharacters: ['"', "'", '`', ' ', '.', '(', '[', ']', '!', '/', '-', ':'],
          },
        }),
      ]),
    )

    let countBeforeChange = client.serverCapabilities.length
    let capabilitiesDidChange = Promise.race([
      new Promise<void>((_, reject) => {
        setTimeout(() => reject('capabilities did not change within 5s'), 5_000)
      }),

      new Promise<void>((resolve) => {
        client.onServerCapabilitiesChanged(() => {
          if (client.serverCapabilities.length !== countBeforeChange) return
          resolve()
        })
      }),
    ])

    await fs.writeFile(
      `${root}/tailwind.config.js`,
      js`
      module.exports = {
        separator: '_',
      }
    `,
    )

    // After changing the config
    client.notifyChangedFiles({
      changed: [`${root}/tailwind.config.js`],
    })

    // We should see that the capabilities have changed
    await capabilitiesDidChange

    // Capabilities are now registered
    expect(client.serverCapabilities).toContainEqual(
      expect.objectContaining({
        method: 'textDocument/hover',
      }),
    )

    expect(client.serverCapabilities).toContainEqual(
      expect.objectContaining({
        method: 'textDocument/completion',
        registerOptions: {
          documentSelector: null,
          resolveProvider: true,
          triggerCharacters: ['"', "'", '`', ' ', '.', '(', '[', ']', '!', '/', '-', '_'],
        },
      }),
    )

    expect(client.serverCapabilities).not.toContainEqual(
      expect.objectContaining({
        method: 'textDocument/completion',
        registerOptions: {
          documentSelector: null,
          resolveProvider: true,
          triggerCharacters: ['"', "'", '`', ' ', '.', '(', '[', ']', '!', '/', '-', ':'],
        },
      }),
    )
  },
})

defineTest({
  name: 'Config updates do not register new trigger characters if the separator has not changed',
  fs: {
    'tailwind.config.js': js`
      module.exports = {
        separator: ':',
        theme: {
          colors: {
            primary: '#f00',
          }
        }
      }
    `,
  },
  prepare: async ({ root }) => ({ client: await createClient({ root }) }),
  handle: async ({ root, client }) => {
    // Initially don't have any registered capabilities because dynamic
    // registration is delayed until after project initialization
    expect(client.serverCapabilities).toEqual([])

    // We open a document so a project gets initialized
    await client.open({
      lang: 'html',
      text: '<div class="bg-[#000]/25 hover:">',
    })

    // And now capabilities are registered
    expect(client.serverCapabilities).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          method: 'textDocument/hover',
        }),

        expect.objectContaining({
          method: 'textDocument/completion',
          registerOptions: {
            documentSelector: null,
            resolveProvider: true,
            triggerCharacters: ['"', "'", '`', ' ', '.', '(', '[', ']', '!', '/', '-', ':'],
          },
        }),
      ]),
    )

    let idsBefore = client.serverCapabilities.map((cap) => cap.id)

    await fs.writeFile(
      `${root}/tailwind.config.js`,
      js`
      module.exports = {
        separator: ':',
        theme: {
          colors: {
            primary: '#0f0',
          }
        }
      }
    `,
    )

    let didReload = new Promise((resolve) => {
      client.conn.onNotification('@/tailwindCSS/projectReloaded', resolve)
    })

    // After changing the config
    client.notifyChangedFiles({
      changed: [`${root}/tailwind.config.js`],
    })

    // Wait for the project to finish building
    await didReload

    // No capabilities should have changed
    let idsAfter = client.serverCapabilities.map((cap) => cap.id)

    expect(idsBefore).toEqual(idsAfter)
  },
})
