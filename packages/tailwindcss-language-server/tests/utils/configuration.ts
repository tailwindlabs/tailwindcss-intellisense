import type { Settings } from '@tailwindcss/language-service/src/util/state'
import { URI } from 'vscode-uri'
import type { DeepPartial } from './types'
import { CacheMap } from '../../src/cache-map'
import deepmerge from 'deepmerge'

export interface Configuration {
  get(uri: string | null): Settings
  set(uri: string | null, value: DeepPartial<Settings>): void
}

export function createConfiguration(): Configuration {
  let defaults: Settings = {
    editor: {
      tabSize: 2,
    },
    tailwindCSS: {
      inspectPort: null,
      emmetCompletions: false,
      includeLanguages: {},
      classAttributes: ['class', 'className', 'ngClass', 'class:list'],
      suggestions: true,
      hovers: true,
      codeActions: true,
      validate: true,
      showPixelEquivalents: true,
      rootFontSize: 16,
      colorDecorators: true,
      lint: {
        cssConflict: 'warning',
        invalidApply: 'error',
        invalidScreen: 'error',
        invalidVariant: 'error',
        invalidConfigPath: 'error',
        invalidTailwindDirective: 'error',
        invalidSourceDirective: 'error',
        recommendedVariantOrder: 'warning',
      },
      experimental: {
        classRegex: [],
        configFile: {},
      },
      files: {
        exclude: ['**/.git/**', '**/node_modules/**', '**/.hg/**', '**/.svn/**'],
      },
    },
  }

  /**
   * Settings per file or directory URI
   */
  let cache = new CacheMap<string | null, Settings>()

  function compute(uri: URI | null) {
    let groups: Partial<Settings>[] = [
      // 1. Extension defaults
      structuredClone(defaults),

      // 2. "Global" settings
      cache.get(null) ?? {},
    ]

    // 3. Workspace and per-file settings
    let components = uri ? uri.path.split('/') : []

    for (let i = 0; i <= components.length; i++) {
      let parts = components.slice(0, i)
      if (parts.length === 0) continue
      let path = parts.join('/')
      let cached = cache.get(uri!.with({ path }).toString())
      if (!cached) continue
      groups.push(cached)
    }

    // Merge all the settings together
    return deepmerge.all<Settings>(groups, {
      arrayMerge: (_target, source) => source,
    })
  }

  function get(uri: string | null) {
    return compute(uri ? URI.parse(uri) : null)
  }

  function set(uri: string | null, value: Settings) {
    cache.set(uri ? URI.parse(uri).toString() : null, value)
  }

  return { get, set }
}
