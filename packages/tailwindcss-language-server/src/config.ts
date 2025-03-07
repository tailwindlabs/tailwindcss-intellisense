import merge from 'deepmerge'
import { isObject } from './utils'
import {
  getDefaultTailwindSettings,
  type Settings,
} from '@tailwindcss/language-service/src/util/state'
import type { Connection } from 'vscode-languageserver'

export interface SettingsCache {
  get(uri?: string): Promise<Settings>
  clear(): void
}

export function createSettingsCache(connection: Connection): SettingsCache {
  const cache: Map<string, Settings> = new Map()

  async function get(uri?: string) {
    let config = cache.get(uri)

    if (!config) {
      config = await load(uri)
      cache.set(uri, config)
    }

    return config
  }

  async function load(uri?: string) {
    let [editor, tailwindCSS] = await Promise.all([
      connection.workspace.getConfiguration({
        section: 'editor',
        scopeUri: uri,
      }),

      connection.workspace.getConfiguration({
        section: 'tailwindCSS',
        scopeUri: uri,
      }),
    ])

    editor = isObject(editor) ? editor : {}
    tailwindCSS = isObject(tailwindCSS) ? tailwindCSS : {}

    return merge<Settings>(
      getDefaultTailwindSettings(),
      { editor, tailwindCSS },
      { arrayMerge: (_destinationArray, sourceArray, _options) => sourceArray },
    )
  }

  return {
    get,
    clear() {
      cache.clear()
    },
  }
}
