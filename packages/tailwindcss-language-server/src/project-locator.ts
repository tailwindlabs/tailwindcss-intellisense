import * as os from 'node:os'
import * as path from 'node:path'
import * as fs from 'node:fs/promises'
import glob from 'fast-glob'
import picomatch from 'picomatch'
import normalizePath from 'normalize-path'
import type { Settings } from '@tailwindcss/language-service/src/util/state'
import { CONFIG_GLOB, CSS_GLOB } from './lib/constants'
import { readCssFile } from './util/css'
import { Graph } from './graph'
import type { Message } from 'postcss'
import { type DocumentSelector, DocumentSelectorPriority } from './projects'
import { CacheMap } from './cache-map'
import { getPackageRoot } from './util/get-package-root'
import resolveFrom from './util/resolveFrom'
import { type Feature, supportedFeatures } from '@tailwindcss/language-service/src/features'
import { pathToFileURL } from 'node:url'
import { resolveCssImports } from './resolve-css-imports'
import { normalizeDriveLetter } from './utils'

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
  constructor(
    private base: string,
    private settings: Settings,
  ) {}

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

    if (projects.length === 1) {
      projects[0].documentSelector.push({
        pattern: normalizePath(path.join(this.base, '**')),
        priority: DocumentSelectorPriority.ROOT_DIRECTORY,
      })
    }

    // Normalize drive letters in filepaths on Windows so paths
    // are consistent across the filesystem and the language client
    for (let project of projects) {
      project.folder = normalizeDriveLetter(project.folder)
      project.configPath = normalizeDriveLetter(project.configPath)
      project.config.path = normalizeDriveLetter(project.config.path)

      for (let entry of project.config.entries) {
        entry.path = normalizeDriveLetter(entry.path)
      }

      for (let selector of project.documentSelector) {
        selector.pattern = normalizeDriveLetter(selector.pattern)
      }
    }

    return projects
  }

  async loadAllFromWorkspace(
    configs: [config: string, selectors: string[]][],
  ): Promise<ProjectConfig[]> {
    return Promise.all(configs.map((config) => this.loadFromWorkspace(config[0], config[1])))
  }

  private async loadFromWorkspace(
    configPath: string,
    selectors: string[],
  ): Promise<ProjectConfig | null> {
    let config: ConfigEntry = {
      type: 'js',
      path: configPath,
      source: 'js',
      entries: [],
      content: [],
      packageRoot: '',
    }

    let tailwind = await this.detectTailwindVersion(config)

    // Look for the package root for the config
    config.packageRoot = await getPackageRoot(path.dirname(config.path), this.base)

    return {
      config,
      folder: this.base,
      isUserConfigured: true,
      configPath: config.path,
      documentSelector: selectors.map((selector) => ({
        priority: DocumentSelectorPriority.USER_CONFIGURED,
        pattern: selector,
      })),
      tailwind,
    }
  }

  private async createProject(config: ConfigEntry): Promise<ProjectConfig | null> {
    let tailwind = await this.detectTailwindVersion(config)

    console.log(JSON.stringify({ tailwind }))

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

    // This is a CSS-based Tailwind config
    if (config.type === 'css') {
      // This version of Tailwind doesn't support CSS-based configuration
      if (!tailwind.features.includes('css-at-theme')) {
        return null
      }
    }

    // Don't boot a project for the CS config if using Tailwind v4
    if (config.type === 'js' && tailwind.features.includes('css-at-theme')) {
      return null
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
    for await (let selector of contentSelectorsFromConfig(config, tailwind.features)) {
      selectors.push(selector)
    }

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
        documentSelectors.findIndex(({ pattern: p }) => p === pattern) === index,
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

    let isCss = picomatch(`**/${CSS_GLOB}`, { dot: true })

    // Create a list of entries for each file
    let entries = files.map((filepath: string): FileEntry => {
      if (isCss(filepath)) {
        return new FileEntry('css', filepath)
      }

      return new FileEntry('js', filepath, [
        configs.remember(filepath, () => ({
          source: 'js',
          type: 'js',
          path: filepath,
          entries: [],
          packageRoot: null,
          content: [],
        })),
      ])
    })

    // Gather all the CSS files to check for configs
    let css = entries.filter((entry) => entry.type === 'css')

    // Read the content of all the CSS files
    await Promise.all(css.map((entry) => entry.read()))

    // Keep track of files that might import or involve Tailwind in some way
    let imports: FileEntry[] = []

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
            content: [],
          })),
        )
        continue
      }

      // Look for `@import` or `@tailwind` directives
      if (file.isMaybeTailwindRelated()) {
        imports.push(file)
        continue
      }
    }

    // Resolve imports in all the CSS files
    await Promise.all(imports.map((file) => file.resolveImports()))

    // Create a graph of all the CSS files that might (indirectly) use Tailwind
    let graph = new Graph<FileEntry>()

    let indexPath: string | null = null
    let themePath: string | null = null
    let utilitiesPath: string | null = null

    for (let file of imports) {
      graph.add(file.path, file)

      for (let msg of file.deps) {
        let importedPath: string = normalizePath(msg.file)

        // Record that `file.path` imports `msg.file`
        graph.add(importedPath, new FileEntry('css', importedPath))

        graph.connect(file.path, importedPath)
      }

      // Collect the index, theme, and utilities files for manual connection
      if (file.path.includes('node_modules/tailwindcss/index.css')) {
        indexPath = file.path
      } else if (file.path.includes('node_modules/tailwindcss/theme.css')) {
        themePath = file.path
      } else if (file.path.includes('node_modules/tailwindcss/utilities.css')) {
        utilitiesPath = file.path
      }
    }

    // We flatten the index file on publish so there are no imports that
    // need to be resolved. But this messes with our graph traversal, so
    // we need to manually connect the index file to the theme and utilities
    // files so we do not get extra roots in the graph.
    // - node_modules/tailwindcss/index.css
    // -> node_modules/tailwindcss/theme.css
    // -> node_modules/tailwindcss/utilities.css

    if (indexPath && themePath) graph.connect(indexPath, themePath)
    if (indexPath && utilitiesPath) graph.connect(indexPath, utilitiesPath)

    for (let root of graph.roots()) {
      let config: ConfigEntry = configs.remember(root.path, () => ({
        source: 'css',
        type: 'css',
        path: root.path,
        entries: [],
        packageRoot: null,
        content: [{ kind: 'auto' }],
      }))

      // The root is a CSS entrypoint so lets use it as the "config" file
      // We'll pass the parsed contents when loading the Design System for v4
      root.configs.push(config)

      // And add the config to all their descendants as we need to track updates
      // that might affect the config / project
      for (let child of graph.descendants(root.path)) {
        child.configs.push(config)
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

function contentSelectorsFromConfig(
  entry: ConfigEntry,
  features: Feature[],
  actualConfig?: any,
): AsyncIterable<DocumentSelector> {
  if (entry.type === 'css') {
    return contentSelectorsFromCssConfig(entry)
  }

  if (entry.type === 'js') {
    return contentSelectorsFromJsConfig(entry, features, actualConfig)
  }
}

async function* contentSelectorsFromJsConfig(
  entry: ConfigEntry,
  features: Feature[],
  actualConfig?: any,
): AsyncIterable<DocumentSelector> {
  let config: any

  // This is wrapped in a try catch because a user might be using an ESM- or TypeScript-based config
  // and we don't want to stop the project from loading just because of that. We'll recover the list
  // of document selectors later in the loading process when initializing the project by using
  // Tailwind's `loadConfig` API. Ideally the configuration loading is either NOT done here or
  // all of it is done here. But that's a much larger refactor.
  try {
    config = actualConfig ?? require(entry.path)
  } catch {
    return
  }

  let files: unknown = config.content?.files ?? config.content
  let content: (string | {})[] = Array.isArray(files) ? files : []

  let relative = features.includes('relative-content-paths')
    ? config.future?.relativeContentPathsByDefault || config.content?.relative
    : false

  let contentBase = relative ? path.dirname(entry.path) : entry.packageRoot

  for (let item of content) {
    if (typeof item !== 'string') continue

    let filepath = item.startsWith('!')
      ? `!${path.resolve(contentBase, item.slice(1))}`
      : path.resolve(contentBase, item)

    yield {
      pattern: normalizePath(filepath),
      priority: DocumentSelectorPriority.CONTENT_FILE,
    }
  }
}

async function* contentSelectorsFromCssConfig(entry: ConfigEntry): AsyncIterable<DocumentSelector> {
  let auto = false
  for (let item of entry.content) {
    if (item.kind === 'file') {
      yield {
        pattern: normalizePath(item.file),
        priority: DocumentSelectorPriority.CONTENT_FILE,
      }
    } else if (item.kind === 'auto' && !auto) {
      auto = true
      for await (let pattern of detectContentFiles(entry.packageRoot)) {
        yield {
          pattern,
          priority: DocumentSelectorPriority.CONTENT_FILE,
        }
      }
    }
  }
}

async function* detectContentFiles(base: string): AsyncIterable<string> {
  try {
    let oxidePath = resolveFrom(path.dirname(base), '@tailwindcss/oxide')
    oxidePath = pathToFileURL(oxidePath).href

    const oxide: typeof import('@tailwindcss/oxide') = await import(oxidePath)

    // This isn't a v4 project
    if (!oxide.scanDir) return

    let { files, globs } = oxide.scanDir({ base, globs: true })

    for (let file of files) {
      yield normalizePath(file)
    }

    for (let { base, glob } of globs) {
      // Do not normalize the glob itself as it may contain escape sequences
      yield normalizePath(base) + '/' + glob
    }
  } catch {
    //
  }
}

type ContentItem =
  | { kind: 'file'; file: string }
  | { kind: 'raw'; content: string }
  | { kind: 'auto' }

type ConfigEntry = {
  type: 'js' | 'css'
  source: 'js' | 'css'
  path: string
  entries: FileEntry[]
  packageRoot: string
  content: ContentItem[]
}

class FileEntry {
  content: string | null
  deps: Message[] = []

  constructor(
    public type: 'js' | 'css',
    public path: string,
    public configs: ConfigEntry[] = [],
  ) {}

  async read() {
    try {
      this.content = await readCssFile(this.path)
    } catch {
      this.content = null
    }
  }

  async resolveImports() {
    try {
      let result = await resolveCssImports().process(this.content, { from: this.path })
      this.deps = result.messages.filter((msg) => msg.type === 'dependency')

      // Replace the file content with the processed CSS
      this.content = result.css
    } catch {
      //
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

  /**
   * Look for `@import` or `@tailwind` directives in a CSS file. This means that
   * participates in the CSS "graph" for the project and we need to traverse
   * the graph to find all the CSS files that are considered entrypoints.
   */
  isMaybeTailwindRelated(): boolean {
    if (!this.content) return false

    let HAS_IMPORT = /@import\s*(?<config>'[^']+'|"[^"]+");/
    let HAS_TAILWIND = /@tailwind\s*[^;]+;/
    let HAS_THEME = /@theme\s*\{/

    return (
      HAS_IMPORT.test(this.content) ||
      HAS_TAILWIND.test(this.content) ||
      HAS_THEME.test(this.content)
    )
  }
}
