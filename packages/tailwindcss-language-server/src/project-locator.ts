import * as os from 'node:os'
import * as path from 'node:path'
import * as fs from 'node:fs/promises'
import glob from 'fast-glob'
import minimatch from 'minimatch'
import normalizePath from 'normalize-path'
import type { Settings } from 'tailwindcss-language-service/src/util/state'
import { CONFIG_GLOB, CSS_GLOB } from './lib/constants'
import { readCssFile } from './util/css'
import { DocumentSelector, DocumentSelectorPriority } from './projects'
import { CacheMap } from './cache-map'
import { getPackageRoot } from './util/get-package-root'
import resolveFrom from './util/resolveFrom'
import { Feature, supportedFeatures } from './features'

export interface ProjectConfig {
  /** The folder that contains the project */
  folder: string

  /** The path to the config file (if it exists) */
  configPath?: string

  /** The list of documents that are related to this project */
  documentSelector?: DocumentSelector[]

  /** Whether or not this project was explicitly defined by the user */
  isUserConfigured: boolean

  /** Details about the config file */
  config: ConfigEntry

  /** Details about the version of Tailwind used in this project */
  tailwind: {
    version: string
    features: string[]
    isDefaultVersion: boolean
  }
}

export class ProjectLocator {
  constructor(private base: string, private settings: Settings) {}

  async search(): Promise<ProjectConfig[]> {
    // Locate all the Tailwind CSS config files in the project
    let configs = await this.findConfigs()

    // Create a project for each of the config files
    let results = await Promise.allSettled(configs.map((config) => this.createProject(config)))
    let projects: ProjectConfig[] = []

    for (let result of results) {
      if (result.status === 'rejected') {
        console.error(`[GLOBAL] Error creating project: ${result.reason}`)
      } else if (result.status === 'fulfilled' && result.value) {
        projects.push(result.value)
      }
    }

    return projects
  }

  private async createProject(config: ConfigEntry): Promise<ProjectConfig | null> {
    let tailwind = await this.detectTailwindVersion(config)

    // A JS/TS config file was loaded from an `@config`` directive in a CSS file
    if (config.type === 'js' && config.source === 'css') {
      // We only allow local versions of Tailwind to use `@config` directives
      if (tailwind.isDefaultVersion) {
        return null
      }

      // This version of Tailwind doesn't support `@config` directives
      if (!tailwind.features.includes('css-at-config')) {
        return null
      }
    }

    // This is a TypeScript or ESM-based Tailwind config
    if (config.type === 'js' && (config.path.endsWith('.ts') || config.path.endsWith('.mjs'))) {
      // This version of Tailwind doesn't support transpiling configs
      if (!tailwind.features.includes('transpiled-configs')) {
        return null
      }
    }

    // Look for the package root for the config
    config.packageRoot = await getPackageRoot(path.dirname(config.path), this.base)

    let selectors: DocumentSelector[] = []

    // selectors:
    // - CSS files
    for (let entry of config.entries) {
      if (entry.type !== 'css') continue
      selectors.push({
        pattern: entry.path,
        priority: DocumentSelectorPriority.CSS_FILE,
      })
    }

    // - Config File
    selectors.push({
      pattern: config.path,
      priority: DocumentSelectorPriority.CONFIG_FILE,
    })

    // - Content patterns from config
    let content = await contentSelectorsFromConfig(config, tailwind.features)
    selectors.push(...content)

    // - Directories containing the CSS files
    for (let entry of config.entries) {
      if (entry.type !== 'css') continue
      selectors.push({
        pattern: normalizePath(path.join(path.dirname(entry.path), '**')),
        priority: DocumentSelectorPriority.CSS_DIRECTORY,
      })
    }

    // - Directory containing the config
    selectors.push({
      pattern: normalizePath(path.join(path.dirname(config.path), '**')),
      priority: DocumentSelectorPriority.CONFIG_DIRECTORY,
    })

    // - Root of package that contains the config
    selectors.push({
      pattern: normalizePath(path.join(config.packageRoot, '**')),
      priority: DocumentSelectorPriority.PACKAGE_DIRECTORY,
    })

    // Reorder selectors from most specific to least specific
    selectors.sort((a, z) => a.priority - z.priority)

    // Eliminate duplicate selector patterns
    selectors = selectors.filter(
      ({ pattern }, index, documentSelectors) =>
        documentSelectors.findIndex(({ pattern: p }) => p === pattern) === index
    )

    return {
      config,
      folder: this.base,
      isUserConfigured: false,
      configPath: config.path,
      documentSelector: selectors,
      tailwind,
    }
  }

  private async findConfigs(): Promise<ConfigEntry[]> {
    // Look for config files and CSS files
    let files = await glob([`**/${CONFIG_GLOB}`, `**/${CSS_GLOB}`], {
      cwd: this.base,
      ignore: this.settings.tailwindCSS.files.exclude,
      onlyFiles: true,
      absolute: true,
      suppressErrors: true,
      dot: true,
      concurrency: Math.max(os.cpus().length, 1),
    })

    // Resolve symlinks for all found files
    files = await Promise.all(files.map(async (file) => normalizePath(await fs.realpath(file))))

    // Deduplicate the list of files and sort them for deterministic results
    // across environments
    files = Array.from(new Set(files)).sort()

    // Create a map of config paths to metadata
    let configs = new CacheMap<string, ConfigEntry>()

    // Create a list of entries for each file
    let entries = files.map((filepath: string): FileEntry => {
      let isCss = minimatch(filepath, `**/${CSS_GLOB}`, { dot: true })

      if (isCss) {
        return new FileEntry('css', filepath)
      }

      return new FileEntry('css', filepath, [
        configs.remember(filepath, () => ({
          source: 'js',
          type: 'js',
          path: filepath,
          entries: [],
          packageRoot: null,
        })),
      ])
    })

    // Gather all the CSS files to check for configs
    let css = entries.filter((entry) => entry.type === 'css')

    // Read the content of all the CSS files
    await Promise.all(css.map((entry) => entry.read()))

    for (let file of css) {
      // If the CSS file couldn't be read for some reason, skip it
      if (!file.content) continue

      // Find `@config` directives in CSS files and resolve them to the actual
      // config file that they point to.
      let configPath = file.configPathInCss()
      if (configPath) {
        // We don't need the content for this file anymore
        file.content = null
        file.configs.push(
          configs.remember(configPath, () => ({
            // A CSS file produced a JS config file
            source: 'css',
            type: 'js',
            path: configPath,
            entries: [],
            packageRoot: null,
          }))
        )
        continue
      }
    }

    // Populate the entry list of each config file
    for (let entry of entries) {
      for (let config of entry.configs) {
        config.entries.push(entry)
      }
    }

    return Array.from(configs.values())
  }

  private async detectTailwindVersion(config: ConfigEntry) {
    try {
      let metadataPath = resolveFrom(path.dirname(config.path), 'tailwindcss/package.json')
      let { version } = require(metadataPath)
      let features = supportedFeatures(version)

      if (typeof version === 'string') {
        return {
          version,
          features,
          isDefaultVersion: false,
        }
      }
    } catch {}

    let { version } = require('tailwindcss/package.json')
    let features = supportedFeatures(version)

    return {
      version,
      features,
      isDefaultVersion: true,
    }
  }
}

async function contentSelectorsFromConfig(
  entry: ConfigEntry,
  features: Feature[],
  actualConfig?: any
): Promise<DocumentSelector[]> {
  let config = actualConfig ?? require(entry.path)
  let files: unknown = config.content?.files ?? config.content
  let content = Array.isArray(files) ? files : []

  let relative = features.includes('relative-content-paths')
    ? config.future?.relativeContentPathsByDefault || config.content?.relative
    : false

  let contentBase = relative ? path.dirname(entry.path) : entry.packageRoot

  return content
    .filter((item): item is string => typeof item === 'string')
    .map((item) =>
      item.startsWith('!')
        ? `!${path.resolve(contentBase, item.slice(1))}`
        : path.resolve(contentBase, item)
    )
    .map((item) => ({
      pattern: normalizePath(item),
      priority: DocumentSelectorPriority.CONTENT_FILE,
    }))
}

type ConfigEntry = {
  type: 'js'
  source: 'js' | 'css'
  path: string
  entries: FileEntry[]
  packageRoot: string
}

class FileEntry {
  content: string | null

  constructor(public type: 'js' | 'css', public path: string, public configs: ConfigEntry[] = []) {}

  async read() {
    try {
      this.content = await readCssFile(this.path)
    } catch {
      this.content = null
    }
  }

  /**
   * Look for `@config` directives in a CSS file and return the path to the config
   * file that it points to. This path is (possibly) relative to the CSS file so
   * it must be resolved to an absolute path before returning.
   */
  configPathInCss(): string | null {
    if (!this.content) return null

    let match = this.content.match(/@config\s*(?<config>'[^']+'|"[^"]+")/)
    if (!match) {
      return null
    }

    return normalizePath(path.resolve(path.dirname(this.path), match.groups.config.slice(1, -1)))
  }
}
