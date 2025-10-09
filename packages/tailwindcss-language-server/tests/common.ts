import * as path from 'node:path'
import { beforeAll, describe } from 'vitest'
import { DidChangeTextDocumentNotification } from 'vscode-languageserver'
import type { ProtocolConnection } from 'vscode-languageclient'
import type { Feature } from '@tailwindcss/language-service/src/features'
import { URI } from 'vscode-uri'
import { Client, createClient } from './utils/client'

type Settings = any

interface FixtureContext
  extends Pick<ProtocolConnection, 'sendRequest' | 'sendNotification' | 'onNotification'> {
  client: Client
  openDocument: (params: {
    text: string
    lang?: string
    dir?: string
    name?: string | null
    settings?: Settings
  }) => Promise<{ uri: string; updateSettings: (settings: Settings) => Promise<void> }>
  updateSettings: (settings: Settings) => Promise<void>
  updateFile: (file: string, text: string) => Promise<void>
  fixtureUri(fixture: string): string

  readonly project: {
    config: string
    tailwind: {
      version: string
      features: Feature[]
      isDefaultVersion: boolean
    }
  }
}

export interface InitOptions {
  /**
   * How to connect to the LSP:
   * - `in-band` runs the server in the same process (default)
   * - `spawn` launches the binary as a separate process, connects via stdio,
   * and requires a rebuild of the server after making changes.
   */
  mode?: 'in-band' | 'spawn'

  /**
   * Extra initialization options to pass to the LSP
   */
  options?: Record<string, any>

  /**
   * Settings to provide the server immediately when it starts
   */
  settings?: Settings
}

export async function init(
  fixture: string | string[],
  opts: InitOptions = {},
): Promise<FixtureContext> {
  let workspaces: Record<string, string> = {}
  let fixtures = Array.isArray(fixture) ? fixture : [fixture]

  function fixturePath(fixture: string) {
    return path.resolve('./tests/fixtures', fixture)
  }

  function resolveUri(...parts: string[]) {
    const filepath =
      fixtures.length > 1
        ? path.resolve('./tests/fixtures', ...parts)
        : path.resolve('./tests/fixtures', fixtures[0], ...parts)

    return URI.file(filepath).toString()
  }

  for (let [idx, fixture] of fixtures.entries()) {
    workspaces[`Fixture ${idx}`] = fixturePath(fixture)
  }

  let client = await createClient({
    server: 'tailwindcss',
    mode: opts.mode,
    options: opts.options,
    root: workspaces,
    settings: opts.settings,
  })

  let counter = 0
  let projectDetails: any = null

  client.project().then((project) => {
    projectDetails = project
  })

  // TODO: This shouldn't be needed
  // The server should either delay requests *or*
  // openDocument shouldn't return until the project its a part of has been
  // built otherwise all requests will return nothing and it's not something
  // we can await directly right now
  //
  // Like maybe documentReady should be delayed by project build state?
  // because otherwise the document isn't really ready anyway
  let projectBuilt = new Promise<void>((resolve) => {
    client.conn.onNotification('@/tailwindCSS/projectReloaded', () => resolve())
  })

  return {
    client,
    fixtureUri(fixture: string) {
      return URI.file(fixturePath(fixture)).toString()
    },
    get project() {
      return projectDetails
    },
    sendRequest(type: any, params: any) {
      return client.conn.sendRequest(type, params)
    },
    sendNotification(type: any, params?: any) {
      return client.conn.sendNotification(type, params)
    },
    onNotification(type: any, callback: any) {
      return client.conn.onNotification(type, callback)
    },
    async openDocument({
      text,
      lang = 'html',
      dir = '',
      name = null,
      settings = {},
    }: {
      text: string
      lang?: string
      dir?: string
      name?: string | null
      settings?: Settings
    }) {
      let uri = resolveUri(dir, name ?? `file-${counter++}`)

      let doc = await client.open({
        lang,
        text,
        uri,
        settings,
      })

      await projectBuilt

      return {
        get uri() {
          return doc.uri.toString()
        },
        async updateSettings(settings: Settings) {
          await doc.update({ settings })
        },
      }
    },

    async updateSettings(newSettings: Settings) {
      await client.updateSettings(newSettings)
    },

    async updateFile(file: string, text: string) {
      let uri = resolveUri(file)
      await client.conn.sendNotification(DidChangeTextDocumentNotification.type, {
        textDocument: { uri, version: counter++ },
        contentChanges: [{ text }],
      })
    },
  }
}

export function withFixture(fixture: string, callback: (c: FixtureContext) => void) {
  describe(fixture, () => {
    let c: FixtureContext = {} as any

    beforeAll(async () => {
      // Using the connection object as the prototype lets us access the connection
      // without defining getters for all the methods and also lets us add helpers
      // to the connection object without having to resort to using a Proxy
      Object.setPrototypeOf(c, await init(fixture))

      return () => c.client.conn.dispose()
    })

    callback(c)
  })
}

export function withWorkspace({
  fixtures,
  run,
}: {
  fixtures: string[]
  run: (c: FixtureContext) => void
}) {
  describe(`workspace: ${fixtures.join(', ')}`, () => {
    let c: FixtureContext = {} as any

    beforeAll(async () => {
      // Using the connection object as the prototype lets us access the connection
      // without defining getters for all the methods and also lets us add helpers
      // to the connection object without having to resort to using a Proxy
      Object.setPrototypeOf(c, await init(fixtures))

      return () => c.client.conn.dispose()
    })

    run(c)
  })
}
