import merge from 'deepmerge'
import { isObject } from './utils'
import { Settings } from '@tailwindcss/language-service/src/util/state'
import { Connection } from 'vscode-languageserver'

export interface SettingsCache {
  getConfiguration(uri?: string): Promise<Settings>
  clear(): void
}

export function createSettingsCache(connection: Connection): SettingsCache {
  const documentSettingsCache: Map<string, Settings> = new Map()

  async function getConfiguration(uri?: string) {
    if (documentSettingsCache.has(uri)) {
      return documentSettingsCache.get(uri)
    }
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

    let config: Settings = merge<Settings>(
      {
        editor: { tabSize: 2 },
        tailwindCSS: {
          emmetCompletions: false,
          classAttributes: ['class', 'className', 'ngClass'],
          codeActions: true,
          hovers: true,
          suggestions: true,
          validate: true,
          colorDecorators: true,
          rootFontSize: 16,
          lint: {
            cssConflict: 'warning',
            invalidApply: 'error',
            invalidScreen: 'error',
            invalidVariant: 'error',
            invalidConfigPath: 'error',
            invalidTailwindDirective: 'error',
            recommendedVariantOrder: 'warning',
          },
          showPixelEquivalents: true,
          includeLanguages: {},
          files: { exclude: ['**/.git/**', '**/node_modules/**', '**/.hg/**', '**/.svn/**'] },
          experimental: {
            classRegex: [],
            configFile: null,
          },
        },
      },
      { editor, tailwindCSS },
      { arrayMerge: (_destinationArray, sourceArray, _options) => sourceArray }
    )

    documentSettingsCache.set(uri, config)

    return config
  }

  return {
    getConfiguration,
    clear() {
      documentSettingsCache.clear()
    },
  }
}
