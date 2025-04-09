import * as path from 'node:path'
import * as fs from 'node:fs/promises'
import { glob } from 'tinyglobby'
import picomatch from 'picomatch'
import type { Settings } from '@tailwindcss/language-service/src/util/state'
import { CONFIG_GLOB, CSS_GLOB } from './lib/constants'
import { readCssFile } from './util/css'
import { Graph } from './graph'
import { type DocumentSelector, DocumentSelectorPriority } from './projects'
import { CacheMap } from './cache-map'
import { getPackageRoot } from './util/get-package-root'
import type { Resolver } from './resolver'
import { type Feature, supportedFeatures } from '@tailwindcss/language-service/src/features'
import { extractSourceDirectives, resolveCssImports } from './css'
import { normalizeDriveLetter, normalizePath, pathToFileURL } from './utils'
import postcss from 'postcss'
import * as oxide from './oxide'
import { analyzeStylesheet, TailwindStylesheet } from './version-guesser'

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
    private resolver: Resolver,
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
    let config: ConfigEntry = configPath.endsWith('.css')
      ? {
          type: 'css',
          path: configPath,
          source: 'css',
          entries: [],
          content: [],
          packageRoot: '',
        }
      : {
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

    let possibleVersions = config.entries.flatMap((entry) => entry.meta?.versions ?? [])

    console.log(
      JSON.stringify({
        tailwind,
        path: config.path,
      }),
    )

    // A JS/TS config file was loaded from an `@config` directive in a CSS file
    // This is only relevant for v3 projects so we'll do some feature detection
    // to verify if this is supported in the current version of Tailwind.
    if (config.type === 'js' && config.source === 'css') {
      // We only allow local versions of Tailwind to use `@config` directives
      if (tailwind.isDefaultVersion) {
        return null
      }

      // This version of Tailwind doesn't support considering `@config` directives
      // as a project on their own.
      if (!tailwind.features.includes('css-at-config-as-project')) {
        return null
      }
    }

    // This is a CSS-based Tailwind config
    if (config.type === 'css') {
      // This version of Tailwind doesn't support CSS-based configuration
      if (!tailwind.features.includes('css-at-theme')) {
        return null
      }

      // This config doesn't include any v4 features (even ones that were also in v3)
      if (!possibleVersions.includes('4')) {
        console.warn(
          `The config ${config.path} looks like it might be for a different Tailwind CSS version. Skipping.`,
        )

        return null
      }

      // v4 does not support .sass, .scss, .less, and .styl files as configs
      if (requiresPreprocessor(config.path)) {
        console.warn(
          `The config ${config.path} requires a preprocessor and is not supported by Tailwind CSS v4.0.`,
        )

        return null
      }
    }

    // Don't boot a project for the JS config if using Tailwind v4
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
    for await (let selector of contentSelectorsFromConfig(
      config,
      tailwind.features,
      this.resolver,
    )) {
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
    let ignore = this.settings.tailwindCSS.files.exclude

    // NOTE: This is a temporary workaround for a bug in the `fdir` package used
    // by `tinyglobby`. It infinite loops when the ignore pattern starts with
    // a `/`. This should be removed once the bug is fixed.
    ignore = ignore.map((pattern) => {
      if (!pattern.startsWith('/')) return pattern

      return pattern.slice(1)
    })

    // Look for config files and CSS files
    let files = await glob({
      patterns: [`**/${CONFIG_GLOB}`, `**/${CSS_GLOB}`],
      cwd: this.base,
      ignore,
      onlyFiles: true,
      absolute: true,
      followSymbolicLinks: true,
      dot: true,
    })

    let realpaths = await Promise.all(files.map((file) => fs.realpath(file)))

    // Remove files that are symlinked yet have an existing file in the list
    files = files.filter((normalPath, idx) => {
      let realPath = realpaths[idx]

      if (normalPath === realPath) {
        return true
      }

      // If the file is a symlink, aliased path, network share, etc…; AND
      // the realpath is not already in the list of files, then we can add
      // the file to the list of files
      //
      // For example, node_modules in a monorepo setup would be symlinked
      // and list both unless you opened one of the directories directly
      else if (!files.includes(realPath)) {
        return true
      }

      return false
    })

    // Make sure Windows-style paths are normalized
    files = files.map((file) => normalizePath(file))

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

    // Determine what tailwind versions each file might be using
    await Promise.all(css.map((entry) => entry.resolvePossibleVersions()))

    // Keep track of files that might import or involve Tailwind in some way
    let imports: FileEntry[] = []

    for (let file of css) {
      // If the CSS file couldn't be read for some reason, skip it
      if (!file.content) continue
      if (!file.meta) continue

      // This file doesn't appear to use Tailwind CSS nor any imports
      // so we can skip it
      if (file.meta.versions.length === 0) continue

      // Find `@config` directives in CSS files and resolve them to the actual
      // config file that they point to. This is only relevant for v3 which
      // we'll verify after config resolution.
      let configPath = file.configPathInCss()
      if (configPath) {
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
      }

      imports.push(file)
    }

    // Resolve imports in all the CSS files
    await Promise.all(imports.map((file) => file.resolveImports(this.resolver)))

    // Resolve real paths for all the files in the CSS import graph
    await Promise.all(imports.map((file) => file.resolveRealpaths()))

    // Resolve all @source directives
    await Promise.all(imports.map((file) => file.resolveSourceDirectives()))

    // Create a graph of all the CSS files that might (indirectly) use Tailwind
    let graph = new Graph<FileEntry>()

    let indexPath: string | null = null
    let themePath: string | null = null
    let utilitiesPath: string | null = null

    for (let file of imports) {
      graph.add(file.realpath, file)

      // Record that `file.path` imports `msg.file`
      for (let entry of file.deps) {
        graph.add(entry.realpath, entry)
        graph.connect(file.realpath, entry.realpath)
      }

      // Collect the index, theme, and utilities files for manual connection
      if (file.realpath.includes('node_modules/tailwindcss/index.css')) {
        indexPath = file.realpath
      } else if (file.realpath.includes('node_modules/tailwindcss/theme.css')) {
        themePath = file.realpath
      } else if (file.realpath.includes('node_modules/tailwindcss/utilities.css')) {
        utilitiesPath = file.realpath
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

    // Sort the graph so potential "roots" appear first
    // The entire concept of roots needs to be rethought because it's not always
    // clear what the root of a project is. Even when imports are present a file
    // may import a file that is the actual "root" of the project.
    let roots = Array.from(graph.roots())

    roots.sort((a, b) => {
      return a.meta.root === b.meta.root ? 0 : a.meta.root ? -1 : 1
    })

    for (let root of roots) {
      if (!root.meta) continue

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
      for (let child of graph.descendants(root.realpath)) {
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
      let metadataPath = await this.resolver.resolveCjsId(
        'tailwindcss/package.json',
        path.dirname(config.path),
      )

      let { version } = require(metadataPath)

      let mod: unknown = undefined

      if (this.resolver.hasPnP()) {
        let modPath = await this.resolver.resolveCjsId('tailwindcss', path.dirname(config.path))
        mod = require(modPath)
      } else {
        let modPath = await this.resolver.resolveJsId('tailwindcss', path.dirname(config.path))
        let modURL = pathToFileURL(modPath).href
        mod = await import(modURL)
      }

      let features = supportedFeatures(version, mod)

      if (typeof version === 'string') {
        return {
          version,
          features,
          isDefaultVersion: false,
        }
      }
    } catch {}

    // A local version of Tailwind CSS was not found so we need to use the
    // fallback bundled with the language server. This is especially important
    // for projects using the standalone CLI.

    // This is a v4-style CSS config
    if (config.type === 'css') {
      let { version } = require('tailwindcss-v4/package.json')
      // @ts-ignore
      let mod = await import('tailwindcss-v4')
      let features = supportedFeatures(version, mod)

      return {
        version,
        features,
        isDefaultVersion: true,
      }
    }

    let { version } = require('tailwindcss/package.json')
    let mod = require('tailwindcss')
    let features = supportedFeatures(version, mod)

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
  resolver: Resolver,
): AsyncIterable<DocumentSelector> {
  if (entry.type === 'css') {
    return contentSelectorsFromCssConfig(entry, resolver)
  }

  if (entry.type === 'js') {
    return contentSelectorsFromJsConfig(entry, features)
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

async function* contentSelectorsFromCssConfig(
  entry: ConfigEntry,
  resolver: Resolver,
): AsyncIterable<DocumentSelector> {
  let auto = false
  for (let item of entry.content) {
    if (item.kind === 'file') {
      yield {
        pattern: normalizePath(item.file),
        priority: DocumentSelectorPriority.CONTENT_FILE,
      }
    } else if (item.kind === 'auto' && !auto) {
      auto = true

      // Note: the file representing `entry` is not guaranteed to be the first
      // file so we use `flatMap`` here to simplify the logic but none of the
      // other entries should have sources.
      let sources = entry.entries.flatMap((entry) => entry.sources)

      for await (let pattern of detectContentFiles(
        entry.packageRoot,
        entry.path,
        sources,
        resolver,
      )) {
        yield {
          pattern,
          priority: DocumentSelectorPriority.CONTENT_FILE,
        }
      }
    }
  }
}

async function* detectContentFiles(
  base: string,
  inputFile: string,
  sources: SourcePattern[],
  resolver: Resolver,
): AsyncIterable<string> {
  try {
    let oxidePath = await resolver.resolveJsId('@tailwindcss/oxide', base)
    oxidePath = pathToFileURL(oxidePath).href
    let oxidePackageJsonPath = await resolver.resolveJsId('@tailwindcss/oxide/package.json', base)
    let oxidePackageJson = JSON.parse(await fs.readFile(oxidePackageJsonPath, 'utf8'))

    let result = await oxide.scan({
      oxidePath,
      oxideVersion: oxidePackageJson.version,
      basePath: base,
      sources: sources.map((source) => ({
        base: path.dirname(inputFile),
        pattern: source.pattern,
        negated: source.negated,
      })),
    })

    // This isn't a v4 project
    if (!result) return

    for (let file of result.files) {
      yield normalizePath(file)
    }

    for (let { base, pattern } of result.globs) {
      // Do not normalize the glob itself as it may contain escape sequences
      yield normalizePath(base) + '/' + pattern
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

export interface SourcePattern {
  pattern: string
  negated: boolean
}

class FileEntry {
  content: string | null
  deps: FileEntry[] = []
  realpath: string | null
  sources: SourcePattern[] = []
  meta: TailwindStylesheet | null = null

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

  async resolveImports(resolver: Resolver) {
    // Files that require a preprocessor are not processed
    if (requiresPreprocessor(this.path)) {
      return
    }

    try {
      let result = await resolveCssImports({ resolver, loose: true }).process(this.content, {
        from: this.path,
      })
      let deps = result.messages.filter((msg) => msg.type === 'dependency')

      deps = deps.filter((msg) => {
        return !msg.file.startsWith('/virtual:missing/')
      })

      // Record entries for each of the dependencies
      this.deps = deps.map((msg) => new FileEntry('css', normalizePath(msg.file)))

      // Replace the file content with the processed CSS
      this.content = result.css
    } catch (err) {
      console.debug(`Unable to resolve imports for ${this.path}.`)
      console.debug(`This may result in failure to locate Tailwind CSS projects.`)
      console.error(err)
    }
  }

  async resolveRealpaths() {
    this.realpath = normalizePath(await fs.realpath(this.path))

    await Promise.all(this.deps.map((entry) => entry.resolveRealpaths()))
  }

  async resolveSourceDirectives() {
    try {
      if (this.sources.length > 0) {
        return
      }

      // Note: This should eventually use the DesignSystem to extract the same
      // sources also discovered by tailwind. Since we don't have everything yet
      // to initialize the design system though, we set up a simple postcss at
      // rule exporter instead for now.
      await postcss([extractSourceDirectives(this.sources)]).process(this.content, {
        from: this.realpath,
      })
    } catch (err) {
      //
    }
  }

  /**
   * Determine which Tailwind versions this file might be using
   */
  async resolvePossibleVersions() {
    this.meta = this.content ? analyzeStylesheet(this.content) : null
  }

  /**
   * Look for `@config` directives in a CSS file and return the path to the config
   * file that it points to. This path is (possibly) relative to the CSS file so
   * it must be resolved to an absolute path before returning.
   *
   * This is only useful for v3 projects. While v4 can use `@config` directives
   * the CSS file is still considered the "config" rather than the JS file.
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

function requiresPreprocessor(filepath: string) {
  let ext = path.extname(filepath)

  return ext === '.scss' || ext === '.sass' || ext === '.less' || ext === '.styl' || ext === '.pcss'
}
