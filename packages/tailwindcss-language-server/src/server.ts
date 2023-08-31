import './lib/env'
import {
  CompletionItem,
  CompletionList,
  CompletionParams,
  Connection,
  createConnection,
  DocumentColorParams,
  ColorInformation,
  ColorPresentation,
  Hover,
  InitializeParams,
  InitializeResult,
  TextDocumentPositionParams,
  TextDocuments,
  TextDocumentSyncKind,
  ColorPresentationParams,
  CodeActionParams,
  CodeAction,
  CompletionRequest,
  DocumentColorRequest,
  BulkRegistration,
  CodeActionRequest,
  BulkUnregistration,
  HoverRequest,
  DidChangeWatchedFilesNotification,
  FileChangeType,
  Disposable,
  TextDocumentIdentifier,
  DocumentLinkRequest,
  DocumentLinkParams,
  DocumentLink,
} from 'vscode-languageserver/node'
import { TextDocument } from 'vscode-languageserver-textdocument'
import { URI } from 'vscode-uri'
import { formatError, showError, SilentError } from './util/error'
import glob from 'fast-glob'
import normalizePath from 'normalize-path'
import * as path from 'path'
import * as os from 'os'
import * as fs from 'fs'
import type * as chokidar from 'chokidar'
import findUp from 'find-up'
import minimatch from 'minimatch'
import resolveFrom, { setPnpApi } from './util/resolveFrom'
import { AtRule, Container, Node, Result } from 'postcss'
import Module from 'module'
import Hook from './lib/hook'
import * as semver from 'tailwindcss-language-service/src/util/semver'
import dlv from 'dlv'
import { dset } from 'dset'
import pkgUp from 'pkg-up'
import stackTrace from 'stack-trace'
import extractClassNames from './lib/extractClassNames'
import { klona } from 'klona/full'
import { doHover } from 'tailwindcss-language-service/src/hoverProvider'
import {
  doComplete,
  resolveCompletionItem,
} from 'tailwindcss-language-service/src/completionProvider'
import {
  State,
  FeatureFlags,
  Settings,
  ClassNames,
  Variant,
} from 'tailwindcss-language-service/src/util/state'
import { provideDiagnostics } from './lsp/diagnosticsProvider'
import { doCodeActions } from 'tailwindcss-language-service/src/codeActions/codeActionProvider'
import { getDocumentColors } from 'tailwindcss-language-service/src/documentColorProvider'
import { getDocumentLinks } from 'tailwindcss-language-service/src/documentLinksProvider'
import { debounce } from 'debounce'
import { getModuleDependencies } from './util/getModuleDependencies'
import assert from 'assert'
// import postcssLoadConfig from 'postcss-load-config'
import * as parcel from './watcher/index.js'
import { bigSign } from 'tailwindcss-language-service/src/util/jit'
import { getColor } from 'tailwindcss-language-service/src/util/color'
import * as culori from 'culori'
import namedColors from 'color-name'
import tailwindPlugins from './lib/plugins'
import isExcluded from './util/isExcluded'
import { getFileFsPath, normalizeFileNameToFsPath } from './util/uri'
import { equal } from 'tailwindcss-language-service/src/util/array'
import preflight from 'tailwindcss/lib/css/preflight.css'
import merge from 'deepmerge'
import { getTextWithoutComments } from 'tailwindcss-language-service/src/util/doc'
import { CONFIG_GLOB, CSS_GLOB, PACKAGE_LOCK_GLOB } from './lib/constants'

// @ts-ignore
global.__preflight = preflight
new Function(
  'require',
  '__dirname',
  `
    let oldReadFileSync = require('fs').readFileSync
    require('fs').readFileSync = function (filename, ...args) {
      if (filename === require('path').join(__dirname, 'css/preflight.css')) {
        return global.__preflight
      }
      return oldReadFileSync(filename, ...args)
    }
  `
)(require, __dirname)

const TRIGGER_CHARACTERS = [
  // class attributes
  '"',
  "'",
  '`',
  // between class names
  ' ',
  // @apply and emmet-style
  '.',
  // config/theme helper
  '(',
  '[',
  // JIT "important" prefix
  '!',
  // JIT opacity modifiers
  '/',
] as const

const colorNames = Object.keys(namedColors)

const connection =
  process.argv.length <= 2 ? createConnection(process.stdin, process.stdout) : createConnection()

console.log = connection.console.log.bind(connection.console)
console.error = connection.console.error.bind(connection.console)

process.on('unhandledRejection', (e: any) => {
  connection.console.error(formatError(`Unhandled exception`, e))
})

function deletePropertyPath(obj: any, path: string | string[]): void {
  if (typeof path === 'string') {
    path = path.split('.')
  }

  for (let i = 0; i < path.length - 1; i++) {
    obj = obj[path[i]]
    if (typeof obj === 'undefined') {
      return
    }
  }

  delete obj[path.pop()]
}

function getConfigId(configPath: string, configDependencies: string[]): string {
  return JSON.stringify(
    [configPath, ...configDependencies].map((file) => [file, fs.statSync(file).mtimeMs])
  )
}

function first<T>(...options: Array<() => T>): T {
  for (let i = 0; i < options.length; i++) {
    let option = options[i]
    if (i === options.length - 1) {
      return option()
    } else {
      try {
        return option()
      } catch (_) {}
    }
  }
}

function firstOptional<T>(...options: Array<() => T>): T | undefined {
  for (let i = 0; i < options.length; i++) {
    let option = options[i]
    try {
      return option()
    } catch (_) {}
  }
}

interface ProjectService {
  projectConfig: ProjectConfig
  enabled: () => boolean
  enable: () => void
  documentSelector: () => Array<DocumentSelector>
  state: State
  tryInit: () => Promise<void>
  dispose: () => Promise<void>
  onUpdateSettings: (settings: any) => void
  onFileEvents: (changes: Array<{ file: string; type: FileChangeType }>) => void
  onHover(params: TextDocumentPositionParams): Promise<Hover>
  onCompletion(params: CompletionParams): Promise<CompletionList>
  onCompletionResolve(item: CompletionItem): Promise<CompletionItem>
  provideDiagnostics(document: TextDocument): void
  provideDiagnosticsForce(document: TextDocument): void
  onDocumentColor(params: DocumentColorParams): Promise<ColorInformation[]>
  onColorPresentation(params: ColorPresentationParams): Promise<ColorPresentation[]>
  onCodeAction(params: CodeActionParams): Promise<CodeAction[]>
  onDocumentLinks(params: DocumentLinkParams): DocumentLink[]
  sortClassLists(classLists: string[]): string[]
}

type ProjectConfig = {
  folder: string
  configPath?: string
  documentSelector?: Array<DocumentSelector>
  isUserConfigured: boolean
}

enum DocumentSelectorPriority {
  USER_CONFIGURED = 0,
  CONFIG_FILE = 0,
  CSS_FILE = 0,
  CONTENT_FILE = 1,
  CSS_DIRECTORY = 2,
  CONFIG_DIRECTORY = 3,
  PACKAGE_DIRECTORY = 4,
  ROOT_DIRECTORY = 5,
}
type DocumentSelector = { pattern: string; priority: DocumentSelectorPriority }

function getMode(config: any): unknown {
  if (typeof config.mode !== 'undefined') {
    return config.mode
  }
  if (Array.isArray(config.presets)) {
    for (let i = config.presets.length - 1; i >= 0; i--) {
      let mode = getMode(config.presets[i])
      if (typeof mode !== 'undefined') {
        return mode
      }
    }
  }
}

function deleteMode(config: any): void {
  delete config.mode
  if (Array.isArray(config.presets)) {
    for (let preset of config.presets) {
      deleteMode(preset)
    }
  }
}

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

function clearRequireCache(): void {
  Object.keys(require.cache).forEach((key) => {
    if (!key.endsWith('.node')) {
      delete require.cache[key]
    }
  })
  Object.keys((Module as any)._pathCache).forEach((key) => {
    delete (Module as any)._pathCache[key]
  })
}

function withoutLogs<T>(getter: () => T): T {
  let fns = {
    log: console.log,
    warn: console.warn,
    error: console.error,
  }
  for (let key in fns) {
    console[key] = () => {}
  }
  try {
    return getter()
  } finally {
    for (let key in fns) {
      console[key] = fns[key]
    }
  }
}

function withFallback<T>(getter: () => T, fallback: T): T {
  try {
    return getter()
  } catch (e) {
    return fallback
  }
}

function dirContains(dir: string, file: string): boolean {
  let relative = path.relative(dir, file)
  return !!relative && !relative.startsWith('..') && !path.isAbsolute(relative)
}

function changeAffectsFile(change: string, files: string[]): boolean {
  for (let file of files) {
    if (change === file || dirContains(change, file)) {
      return true
    }
  }
  return false
}

// We need to add parent directories to the watcher:
// https://github.com/microsoft/vscode/issues/60813
function getWatchPatternsForFile(file: string, root: string): string[] {
  let tmp: string
  let dir = path.dirname(file)
  let patterns: string[] = [file, dir]
  if (dir === root) {
    return patterns
  }
  while (true) {
    dir = path.dirname((tmp = dir))
    if (tmp === dir) {
      break
    } else {
      patterns.push(dir)
      if (dir === root) {
        break
      }
    }
  }
  return patterns
}

async function createProjectService(
  projectKey: string,
  projectConfig: ProjectConfig,
  connection: Connection,
  params: InitializeParams,
  documentService: DocumentService,
  updateCapabilities: () => void,
  checkOpenDocuments: () => void,
  refreshDiagnostics: () => void,
  watchPatterns: (patterns: string[]) => void,
  initialTailwindVersion: string
): Promise<ProjectService> {
  let enabled = false
  const folder = projectConfig.folder
  const disposables: Array<Disposable | Promise<Disposable>> = []
  let documentSelector = projectConfig.documentSelector

  let itemDefaults =
    params.capabilities.textDocument?.completion?.completionList?.itemDefaults ?? []

  // VS Code _does_ support `itemDefaults.data` since at least 1.67.0 (this extension's min version)
  // but it doesn't advertise it in its capabilities. So we manually add it here.
  // See also: https://github.com/microsoft/vscode-languageserver-node/issues/1181
  if (params.clientInfo?.name?.includes('Visual Studio Code') && !itemDefaults.includes('data')) {
    itemDefaults.push('data')
  }

  let state: State = {
    enabled: false,
    completionItemData: {
      _projectKey: projectKey,
    },
    editor: {
      connection,
      folder,
      userLanguages: params.initializationOptions?.userLanguages
        ? params.initializationOptions.userLanguages
        : {},
      // TODO
      capabilities: {
        configuration: true,
        diagnosticRelatedInformation: true,
        itemDefaults,
      },
      getConfiguration,
      getDocumentSymbols: (uri: string) => {
        return connection.sendRequest('@/tailwindCSS/getDocumentSymbols', { uri })
      },
      async readDirectory(document, directory) {
        try {
          directory = path.resolve(path.dirname(getFileFsPath(document.uri)), directory)
          let dirents = await fs.promises.readdir(directory, { withFileTypes: true })
          let result: Array<[string, { isDirectory: boolean }] | null> = await Promise.all(
            dirents.map(async (dirent) => {
              let isDirectory = dirent.isDirectory()
              return (await isExcluded(
                state,
                document,
                path.join(directory, dirent.name, isDirectory ? '/' : '')
              ))
                ? null
                : [dirent.name, { isDirectory }]
            })
          )
          return result.filter((item) => item !== null)
        } catch {
          return []
        }
      },
    },
  }

  if (projectConfig.configPath) {
    let deps = []
    try {
      deps = getModuleDependencies(projectConfig.configPath)
    } catch {}
    watchPatterns([
      ...getWatchPatternsForFile(projectConfig.configPath, projectConfig.folder),
      ...deps.flatMap((dep) => getWatchPatternsForFile(dep, projectConfig.folder)),
    ])
  }

  function log(...args: string[]): void {
    console.log(
      `[${path.relative(projectConfig.folder, projectConfig.configPath)}] ${args.join(' ')}`
    )
  }

  function onFileEvents(changes: Array<{ file: string; type: FileChangeType }>): void {
    let needsInit = false
    let needsRebuild = false

    for (let change of changes) {
      let file = normalizePath(change.file)

      let isConfigFile = changeAffectsFile(file, [projectConfig.configPath])
      let isDependency = changeAffectsFile(file, state.dependencies ?? [])
      let isPackageFile = minimatch(file, `**/${PACKAGE_LOCK_GLOB}`, { dot: true })

      if (!isConfigFile && !isDependency && !isPackageFile) continue

      if (!enabled) {
        if (
          !projectConfig.isUserConfigured &&
          projectConfig.configPath &&
          (isConfigFile || isDependency)
        ) {
          documentSelector = [
            ...documentSelector.filter(
              ({ priority }) => priority !== DocumentSelectorPriority.CONTENT_FILE
            ),
            ...getContentDocumentSelectorFromConfigFile(
              projectConfig.configPath,
              initialTailwindVersion,
              projectConfig.folder
            ),
          ]

          checkOpenDocuments()
        }
        continue
      }

      if (change.type === FileChangeType.Created) {
        log('File created:', change.file)
        needsInit = true
        break
      } else if (change.type === FileChangeType.Changed) {
        log('File changed:', change.file)
        if (!state.enabled || isPackageFile) {
          needsInit = true
          break
        } else {
          needsRebuild = true
        }
      } else if (change.type === FileChangeType.Deleted) {
        log('File deleted:', change.file)
        if (!state.enabled || isConfigFile || isPackageFile) {
          needsInit = true
          break
        } else {
          needsRebuild = true
        }
      }
    }

    if (needsInit) {
      tryInit()
    } else if (needsRebuild) {
      tryRebuild()
    }
  }

  function resetState(): void {
    // clearAllDiagnostics(state)
    Object.keys(state).forEach((key) => {
      // Keep `dependencies` to ensure that they are still watched
      if (key !== 'editor' && key !== 'dependencies') {
        delete state[key]
      }
    })
    state.enabled = false
    refreshDiagnostics()
    updateCapabilities()
    connection.sendNotification('@/tailwindCSS/projectReset')
  }

  async function tryInit() {
    if (!enabled) {
      return
    }
    try {
      await init()
      connection.sendNotification('@/tailwindCSS/projectInitialized')
    } catch (error) {
      resetState()
      showError(connection, error)
    }
  }

  async function tryRebuild() {
    if (!enabled) {
      return
    }
    try {
      await rebuild()
    } catch (error) {
      resetState()
      showError(connection, error)
    }
  }

  async function init() {
    log('Initializing...')

    clearRequireCache()

    let configPath = projectConfig.configPath

    if (!configPath) {
      throw new SilentError('No config file found.')
    }

    watchPatterns(getWatchPatternsForFile(configPath, projectConfig.folder))

    const pnpPath = findUp.sync(
      (dir) => {
        let pnpFile = path.join(dir, '.pnp.js')
        if (findUp.sync.exists(pnpFile)) {
          return pnpFile
        }
        pnpFile = path.join(dir, '.pnp.cjs')
        if (findUp.sync.exists(pnpFile)) {
          return pnpFile
        }
        if (dir === path.normalize(folder)) {
          return findUp.stop
        }
      },
      { cwd: folder }
    )

    if (pnpPath) {
      let pnpApi = require(pnpPath)
      pnpApi.setup()
      setPnpApi(pnpApi)
    }

    const configDependencies = getModuleDependencies(configPath)
    const configId = getConfigId(configPath, configDependencies)
    const configDir = path.dirname(configPath)
    let tailwindcss: any
    let postcss: any
    let postcssSelectorParser: any
    let jitModules: typeof state.modules.jit
    let tailwindcssVersion: string | undefined
    let postcssVersion: string | undefined
    let pluginVersions: string | undefined
    let browserslist: string[] | undefined
    let resolveConfigFn: (config: any) => any
    let loadConfigFn: (path: string) => any
    let featureFlags: FeatureFlags = { future: [], experimental: [] }
    let applyComplexClasses: any

    try {
      const tailwindcssPath = resolveFrom(configDir, 'tailwindcss')
      const tailwindcssPkgPath = resolveFrom(configDir, 'tailwindcss/package.json')
      const tailwindDir = path.dirname(tailwindcssPkgPath)

      const postcssPath = resolveFrom(tailwindDir, 'postcss')
      const postcssPkgPath = resolveFrom(tailwindDir, 'postcss/package.json')
      const postcssDir = path.dirname(postcssPkgPath)
      const postcssSelectorParserPath = resolveFrom(tailwindDir, 'postcss-selector-parser')

      postcssVersion = require(postcssPkgPath).version
      tailwindcssVersion = require(tailwindcssPkgPath).version

      pluginVersions = Object.keys(tailwindPlugins)
        .map((plugin) => {
          try {
            return require(resolveFrom(configDir, `${plugin}/package.json`)).version
          } catch (_) {
            return ''
          }
        })
        .join(',')

      if (
        state.enabled &&
        postcssVersion === state.modules.postcss.version &&
        tailwindcssVersion === state.modules.tailwindcss.version &&
        pluginVersions === state.pluginVersions &&
        configPath === state.configPath &&
        configId === state.configId
      ) {
        return
      }

      log(`Loaded Tailwind CSS config file: ${configPath}`)

      postcss = require(postcssPath)
      postcssSelectorParser = require(postcssSelectorParserPath)
      log(`Loaded postcss v${postcssVersion}: ${postcssDir}`)

      tailwindcss = require(tailwindcssPath)
      log(`Loaded tailwindcss v${tailwindcssVersion}: ${tailwindDir}`)

      try {
        resolveConfigFn = require(resolveFrom(tailwindDir, './resolveConfig.js'))
      } catch (_) {
        try {
          const resolveConfig = require(resolveFrom(tailwindDir, './lib/util/resolveConfig.js'))
          const defaultConfig = require(resolveFrom(tailwindDir, './stubs/defaultConfig.stub.js'))
          resolveConfigFn = (config) => resolveConfig([config, defaultConfig])
        } catch (_) {
          try {
            const resolveConfig = require(resolveFrom(
              tailwindDir,
              './lib/util/mergeConfigWithDefaults.js'
            ))
            const defaultConfig = require(resolveFrom(tailwindDir, './defaultConfig.js'))
            resolveConfigFn = (config) => resolveConfig.default(config, defaultConfig())
          } catch (_) {
            throw Error('Failed to load resolveConfig function.')
          }
        }
      }

      try {
        loadConfigFn = require(resolveFrom(tailwindDir, './loadConfig.js'))
      } catch {}

      if (semver.gte(tailwindcssVersion, '1.4.0') && semver.lte(tailwindcssVersion, '1.99.0')) {
        const browserslistPath = resolveFrom(tailwindDir, 'browserslist')
        // TODO: set path to nearest dir with package.json?
        browserslist = require(browserslistPath)(undefined, { path: folder })
      }

      if (semver.gte(tailwindcssVersion, '1.99.0')) {
        applyComplexClasses = firstOptional(() =>
          require(resolveFrom(tailwindDir, './lib/lib/substituteClassApplyAtRules'))
        )
      } else if (semver.gte(tailwindcssVersion, '1.7.0')) {
        applyComplexClasses = require(resolveFrom(tailwindDir, './lib/flagged/applyComplexClasses'))
      }

      try {
        featureFlags = require(resolveFrom(tailwindDir, './lib/featureFlags.js')).default
      } catch (_) {}

      // stubs
      let tailwindDirectives = new Set()
      let root = postcss.root()
      let result = { opts: {}, messages: [] }
      let registerDependency = () => {}

      try {
        let createContext = first(
          () => {
            let createContextFn = require(resolveFrom(
              configDir,
              'tailwindcss/lib/lib/setupContextUtils'
            )).createContext
            assert.strictEqual(typeof createContextFn, 'function')
            return (state) => createContextFn(state.config)
          },
          () => {
            let createContextFn = require(resolveFrom(
              configDir,
              'tailwindcss/lib/jit/lib/setupContextUtils'
            )).createContext
            assert.strictEqual(typeof createContextFn, 'function')
            return (state) => createContextFn(state.config)
          },
          // TODO: the next two are canary releases only so can probably be removed
          () => {
            let setupTrackingContext = require(resolveFrom(
              configDir,
              'tailwindcss/lib/jit/lib/setupTrackingContext'
            )).default
            assert.strictEqual(typeof setupTrackingContext, 'function')
            return (state) =>
              setupTrackingContext(
                state.configPath,
                tailwindDirectives,
                registerDependency
              )(result, root)
          },
          () => {
            let setupContext = require(resolveFrom(
              configDir,
              'tailwindcss/lib/jit/lib/setupContext'
            )).default
            assert.strictEqual(typeof setupContext, 'function')
            return (state) => setupContext(state.configPath, tailwindDirectives)(result, root)
          }
        )

        jitModules = {
          generateRules: {
            module: first(
              () =>
                require(resolveFrom(configDir, 'tailwindcss/lib/lib/generateRules')).generateRules,
              () =>
                require(resolveFrom(configDir, 'tailwindcss/lib/jit/lib/generateRules'))
                  .generateRules
            ),
          },
          createContext: {
            module: createContext,
          },
          expandApplyAtRules: {
            module: first(
              () =>
                require(resolveFrom(configDir, 'tailwindcss/lib/lib/expandApplyAtRules')).default,
              () =>
                require(resolveFrom(configDir, 'tailwindcss/lib/jit/lib/expandApplyAtRules'))
                  .default
            ),
          },
          evaluateTailwindFunctions: {
            module: firstOptional(
              () =>
                require(resolveFrom(configDir, 'tailwindcss/lib/lib/evaluateTailwindFunctions'))
                  .default
            ),
          },
        }
      } catch (_) {
        try {
          let setupContext = require(resolveFrom(configDir, 'tailwindcss/jit/lib/setupContext'))

          jitModules = {
            generateRules: {
              module: require(resolveFrom(configDir, 'tailwindcss/jit/lib/generateRules'))
                .generateRules,
            },
            createContext: {
              module: (state) => setupContext(state.configPath, tailwindDirectives)(result, root),
            },
            expandApplyAtRules: {
              module: require(resolveFrom(configDir, 'tailwindcss/jit/lib/expandApplyAtRules')),
            },
          }
        } catch (_) {}
      }
    } catch (error) {
      tailwindcss = require('tailwindcss')
      resolveConfigFn = require('tailwindcss/resolveConfig')
      loadConfigFn = require('tailwindcss/loadConfig')
      postcss = require('postcss')
      tailwindcssVersion = require('tailwindcss/package.json').version
      postcssVersion = require('postcss/package.json').version
      postcssSelectorParser = require('postcss-selector-parser')
      jitModules = {
        generateRules: { module: require('tailwindcss/lib/lib/generateRules').generateRules },
        createContext: {
          module: (state) =>
            require('tailwindcss/lib/lib/setupContextUtils').createContext(state.config),
        },
        expandApplyAtRules: {
          module: require('tailwindcss/lib/lib/expandApplyAtRules').default,
        },
      }
      log('Failed to load workspace modules.')
      log(`Using bundled version of \`tailwindcss\`: v${tailwindcssVersion}`)
      log(`Using bundled version of \`postcss\`: v${postcssVersion}`)
    }

    state.configPath = configPath
    state.modules = {
      tailwindcss: { version: tailwindcssVersion, module: tailwindcss },
      postcss: { version: postcssVersion, module: postcss },
      postcssSelectorParser: { module: postcssSelectorParser },
      resolveConfig: { module: resolveConfigFn },
      loadConfig: { module: loadConfigFn },
      jit: jitModules,
    }
    state.browserslist = browserslist
    state.featureFlags = featureFlags
    state.version = tailwindcssVersion
    state.pluginVersions = pluginVersions

    try {
      state.corePlugins = Object.keys(
        require(resolveFrom(path.dirname(state.configPath), 'tailwindcss/lib/plugins/index.js'))
      )
    } catch (_) {}

    if (applyComplexClasses && !applyComplexClasses.default.__patched) {
      let _applyComplexClasses = applyComplexClasses.default
      applyComplexClasses.default = (config, ...args) => {
        if (state.jit) {
          return state.modules.jit.expandApplyAtRules.module(state.jitContext)
        }

        let configClone = klona(config)
        configClone.separator = typeof state.separator === 'undefined' ? ':' : state.separator

        let fn = _applyComplexClasses(configClone, ...args)

        return async (css) => {
          css.walkRules((rule) => {
            const newSelector = rule.selector.replace(/__TWSEP__(.*?)__TWSEP__/g, '$1')
            if (newSelector !== rule.selector) {
              rule.before(
                postcss.comment({
                  text: '__ORIGINAL_SELECTOR__:' + rule.selector,
                })
              )
              rule.selector = newSelector
            }
          })

          await fn(css)

          css.walkComments((comment) => {
            if (comment.text.startsWith('__ORIGINAL_SELECTOR__:')) {
              comment.next().selector = comment.text.replace(/^__ORIGINAL_SELECTOR__:/, '')
              comment.remove()
            }
          })

          return css
        }
      }
      applyComplexClasses.default.__patched = true
    }

    // state.postcssPlugins = { before: [], after: [] }

    // try {
    //   let { plugins: postcssPlugins } = await postcssLoadConfig({ cwd: folder }, state.configPath)
    //   let tailwindIndex = postcssPlugins.findIndex((p) => {
    //     if (typeof p === 'function') {
    //       return (p as any)().postcssPlugin === 'tailwindcss'
    //     }
    //     return (p as any).postcssPlugin === 'tailwindcss'
    //   })
    //   console.log({ postcssPlugins })
    //   if (tailwindIndex !== -1) {
    //     console.log('here')
    //     state.postcssPlugins = {
    //       before: postcssPlugins.slice(0, tailwindIndex),
    //       after: postcssPlugins.slice(tailwindIndex + 1),
    //     }
    //   }
    // } catch (_error) {
    //   console.log(_error)
    // }

    await tryRebuild()
  }

  async function rebuild() {
    log('Building...')

    clearRequireCache()

    const { tailwindcss, postcss, resolveConfig, loadConfig } = state.modules
    const sepLocation = semver.gte(tailwindcss.version, '0.99.0')
      ? ['separator']
      : ['options', 'separator']
    let presetVariants: any[] = []
    let originalConfig: any

    let isV3 = semver.gte(tailwindcss.version, '2.99.0')
    let hook: Hook

    if (loadConfig.module) {
      hook = new Hook(fs.realpathSync(state.configPath))
      try {
        originalConfig = await loadConfig.module(state.configPath)
        originalConfig = originalConfig.default ?? originalConfig
        state.jit = true
      } finally {
        hook.unhook()
      }
    } else {
      hook = new Hook(fs.realpathSync(state.configPath), (exports) => {
        originalConfig = klona(exports)

        let separator = dlv(exports, sepLocation)
        if (typeof separator !== 'string') {
          separator = ':'
        }
        dset(exports, sepLocation, `__TWSEP__${separator}__TWSEP__`)
        exports[isV3 ? 'content' : 'purge'] = []

        let mode = getMode(exports)
        deleteMode(exports)

        let isJit = isV3 || (state.modules.jit && mode === 'jit')

        if (isJit) {
          state.jit = true
          exports.variants = []

          if (Array.isArray(exports.presets)) {
            for (let preset of exports.presets) {
              presetVariants.push(preset.variants)
              preset.variants = []
            }
          }
        } else {
          state.jit = false
        }

        if (state.corePlugins) {
          let corePluginsConfig = {}
          for (let pluginName of state.corePlugins) {
            corePluginsConfig[pluginName] = true
          }
          exports.corePlugins = corePluginsConfig
        }

        // inject JIT `matchUtilities` function
        if (Array.isArray(exports.plugins)) {
          exports.plugins = exports.plugins.map((plugin) => {
            if (plugin.__isOptionsFunction) {
              plugin = plugin()
            }
            if (typeof plugin === 'function') {
              let newPlugin = (...args) => {
                if (!args[0].matchUtilities) {
                  args[0].matchUtilities = () => {}
                }
                return plugin(...args)
              }
              // @ts-ignore
              newPlugin.__intellisense_cache_bust = Math.random()
              return newPlugin
            }
            if (plugin.handler) {
              return {
                ...plugin,
                handler: (...args) => {
                  if (!args[0].matchUtilities) {
                    args[0].matchUtilities = () => {}
                  }
                  return plugin.handler(...args)
                },
                __intellisense_cache_bust: Math.random(),
              }
            }
            return plugin
          })
        }

        return exports
      })

      try {
        require(state.configPath)
      } catch (error) {
        hook.unhook()
        throw error
      }
    }

    if (!originalConfig) {
      throw new SilentError(`Failed to load config file: ${state.configPath}`)
    }

    /////////////////////
    if (!projectConfig.isUserConfigured) {
      documentSelector = [
        ...documentSelector.filter(
          ({ priority }) => priority !== DocumentSelectorPriority.CONTENT_FILE
        ),
        ...getContentDocumentSelectorFromConfigFile(
          state.configPath,
          tailwindcss.version,
          projectConfig.folder,
          originalConfig
        ),
      ]
    }
    //////////////////////

    try {
      state.config = resolveConfig.module(originalConfig)
      state.separator = dlv(state.config, sepLocation)
      if (typeof state.separator !== 'string') {
        state.separator = ':'
      }
      state.blocklist = Array.isArray(state.config.blocklist) ? state.config.blocklist : []
      delete state.config.blocklist

      if (state.jit) {
        state.jitContext = state.modules.jit.createContext.module(state)
        state.jitContext.tailwindConfig.separator = state.config.separator
        if (state.jitContext.getClassList) {
          let classList = state.jitContext
            .getClassList({ includeMetadata: true })
            .filter((className) => className !== '*')
          state.classListContainsMetadata = classList.some((cls) => Array.isArray(cls))
          state.classList = classList.map((className) => {
            if (Array.isArray(className)) {
              return [
                className[0],
                { color: getColor(state, className[0]), ...(className[1] ?? {}) },
              ]
            }
            return [className, { color: getColor(state, className) }]
          })
        }
      } else {
        delete state.jitContext
        delete state.classList
      }
    } catch (error) {
      hook?.unhook()
      throw error
    }

    let postcssResult: Result

    if (state.classList) {
      hook?.unhook()
    } else {
      try {
        postcssResult = await postcss
          .module([
            // ...state.postcssPlugins.before.map((x) => x()),
            tailwindcss.module(state.configPath),
            // ...state.postcssPlugins.after.map((x) => x()),
          ])
          .process(
            [
              semver.gte(tailwindcss.version, '0.99.0') ? 'base' : 'preflight',
              'components',
              'utilities',
            ]
              .map((x) => `/*__tw_intellisense_layer_${x}__*/\n@tailwind ${x};`)
              .join('\n'),
            {
              from: undefined,
            }
          )
      } catch (error) {
        throw error
      } finally {
        hook?.unhook()
      }
    }

    // if (state.dependencies) {
    //   chokidarWatcher?.unwatch(state.dependencies)
    // }
    state.dependencies = getModuleDependencies(state.configPath)
    // chokidarWatcher?.add(state.dependencies)
    watchPatterns(
      (state.dependencies ?? []).flatMap((dep) =>
        getWatchPatternsForFile(dep, projectConfig.folder)
      )
    )

    state.configId = getConfigId(state.configPath, state.dependencies)

    state.plugins = await getPlugins(originalConfig)
    if (postcssResult) {
      state.classNames = (await extractClassNames(postcssResult.root)) as ClassNames
    }
    state.variants = getVariants(state)

    let screens = dlv(state.config, 'theme.screens', dlv(state.config, 'screens', {}))
    state.screens = isObject(screens) ? Object.keys(screens) : []

    state.enabled = true

    // updateAllDiagnostics(state)
    refreshDiagnostics()

    updateCapabilities()
  }

  return {
    projectConfig,
    enabled() {
      return enabled
    },
    enable() {
      enabled = true
    },
    state,
    documentSelector() {
      return documentSelector
    },
    tryInit,
    async dispose() {
      state = { enabled: false }
      for (let disposable of disposables) {
        ;(await disposable).dispose()
      }
    },
    async onUpdateSettings(settings: any): Promise<void> {
      if (state.enabled) {
        refreshDiagnostics()
      }
      if (settings.editor.colorDecorators) {
        updateCapabilities()
      } else {
        connection.sendNotification('@/tailwindCSS/clearColors')
      }
    },
    onFileEvents,
    async onHover(params: TextDocumentPositionParams): Promise<Hover> {
      return withFallback(async () => {
        if (!state.enabled) return null
        let document = documentService.getDocument(params.textDocument.uri)
        if (!document) return null
        let settings = await state.editor.getConfiguration(document.uri)
        if (!settings.tailwindCSS.hovers) return null
        if (await isExcluded(state, document)) return null
        return doHover(state, document, params.position)
      }, null)
    },
    async onCompletion(params: CompletionParams): Promise<CompletionList> {
      return withFallback(async () => {
        if (!state.enabled) return null
        let document = documentService.getDocument(params.textDocument.uri)
        if (!document) return null
        let settings = await state.editor.getConfiguration(document.uri)
        if (!settings.tailwindCSS.suggestions) return null
        if (await isExcluded(state, document)) return null
        return doComplete(state, document, params.position, params.context)
      }, null)
    },
    onCompletionResolve(item: CompletionItem): Promise<CompletionItem> {
      return withFallback(() => {
        if (!state.enabled) return null
        return resolveCompletionItem(state, item)
      }, null)
    },
    async onCodeAction(params: CodeActionParams): Promise<CodeAction[]> {
      return withFallback(async () => {
        if (!state.enabled) return null
        let document = documentService.getDocument(params.textDocument.uri)
        if (!document) return null
        let settings = await state.editor.getConfiguration(document.uri)
        if (!settings.tailwindCSS.codeActions) return null
        return doCodeActions(state, params, document)
      }, null)
    },
    onDocumentLinks(params: DocumentLinkParams): DocumentLink[] {
      if (!state.enabled) return null
      let document = documentService.getDocument(params.textDocument.uri)
      if (!document) return null
      return getDocumentLinks(state, document, (linkPath) =>
        URI.file(path.resolve(path.dirname(URI.parse(document.uri).fsPath), linkPath)).toString()
      )
    },
    provideDiagnostics: debounce(
      (document: TextDocument) => {
        if (!state.enabled) return
        provideDiagnostics(state, document)
      },
      params.initializationOptions?.testMode ? 0 : 500
    ),
    provideDiagnosticsForce: (document: TextDocument) => {
      if (!state.enabled) return
      provideDiagnostics(state, document)
    },
    async onDocumentColor(params: DocumentColorParams): Promise<ColorInformation[]> {
      return withFallback(async () => {
        if (!state.enabled) return []
        let document = documentService.getDocument(params.textDocument.uri)
        if (!document) return []
        if (await isExcluded(state, document)) return null
        return getDocumentColors(state, document)
      }, null)
    },
    async onColorPresentation(params: ColorPresentationParams): Promise<ColorPresentation[]> {
      let document = documentService.getDocument(params.textDocument.uri)
      if (!document) return []
      let className = document.getText(params.range)
      let match = className.match(
        new RegExp(`-\\[(${colorNames.join('|')}|(?:(?:#|rgba?\\(|hsla?\\())[^\\]]+)\\]$`, 'i')
      )
      // let match = className.match(/-\[((?:#|rgba?\(|hsla?\()[^\]]+)\]$/i)
      if (match === null) return []

      let currentColor = match[1]

      let isNamedColor = colorNames.includes(currentColor)

      let color: culori.Color = {
        mode: 'rgb',
        r: params.color.red,
        g: params.color.green,
        b: params.color.blue,
        alpha: params.color.alpha,
      }

      let hexValue = culori.formatHex8(color)

      if (!isNamedColor && (currentColor.length === 4 || currentColor.length === 5)) {
        let [, ...chars] =
          hexValue.match(/^#([a-f\d])\1([a-f\d])\2([a-f\d])\3(?:([a-f\d])\4)?$/i) ?? []
        if (chars.length) {
          hexValue = `#${chars.filter(Boolean).join('')}`
        }
      }

      if (hexValue.length === 5) {
        hexValue = hexValue.replace(/f$/, '')
      } else if (hexValue.length === 9) {
        hexValue = hexValue.replace(/ff$/, '')
      }

      let prefix = className.substr(0, match.index)

      return [
        hexValue,
        culori.formatRgb(color).replace(/ /g, ''),
        culori
          .formatHsl(color)
          .replace(/ /g, '')
          // round numbers
          .replace(/\d+\.\d+(%?)/g, (value, suffix) => `${Math.round(parseFloat(value))}${suffix}`),
      ].map((value) => ({ label: `${prefix}-[${value}]` }))
    },
    sortClassLists(classLists: string[]): string[] {
      if (!state.jit) {
        return classLists
      }

      return classLists.map((classList) => {
        let result = ''
        let parts = classList.split(/(\s+)/)
        let classes = parts.filter((_, i) => i % 2 === 0)
        let whitespace = parts.filter((_, i) => i % 2 !== 0)

        if (classes[classes.length - 1] === '') {
          classes.pop()
        }

        let classNamesWithOrder = state.jitContext.getClassOrder
          ? state.jitContext.getClassOrder(classes)
          : getClassOrderPolyfill(state, classes)

        classes = classNamesWithOrder
          .sort(([, a], [, z]) => {
            if (a === z) return 0
            if (a === null) return -1
            if (z === null) return 1
            return bigSign(a - z)
          })
          .map(([className]) => className)

        for (let i = 0; i < classes.length; i++) {
          result += `${classes[i]}${whitespace[i] ?? ''}`
        }

        return result
      })
    },
  }
}

function prefixCandidate(state: State, selector: string) {
  let prefix = state.config.prefix
  return typeof prefix === 'function' ? prefix(selector) : prefix + selector
}

function getClassOrderPolyfill(state: State, classes: string[]): Array<[string, bigint]> {
  let parasiteUtilities = new Set([prefixCandidate(state, 'group'), prefixCandidate(state, 'peer')])

  let classNamesWithOrder = []

  for (let className of classes) {
    let order =
      state.modules.jit.generateRules
        .module(new Set([className]), state.jitContext)
        .sort(([a], [z]) => bigSign(z - a))[0]?.[0] ?? null

    if (order === null && parasiteUtilities.has(className)) {
      order = state.jitContext.layerOrder.components
    }

    classNamesWithOrder.push([className, order])
  }

  return classNamesWithOrder
}

function isObject(value: unknown): boolean {
  return Object.prototype.toString.call(value) === '[object Object]'
}

type SimplePlugin = (api: any) => {}
type WrappedPlugin = { handler: (api: any) => {} }
type Plugin = SimplePlugin | WrappedPlugin

function runPlugin(
  plugin: Plugin,
  state: State,
  apiOverrides: Record<string, Function> = {}
): void {
  let config = state.config
  let postcss = state.modules.postcss.module
  let browserslist = state.browserslist

  const browserslistTarget = browserslist && browserslist.includes('ie 11') ? 'ie11' : 'relaxed'
  const pluginFn = typeof plugin === 'function' ? plugin : plugin.handler

  try {
    pluginFn({
      addUtilities: () => {},
      addComponents: () => {},
      addBase: () => {},
      matchUtilities: () => {},
      addVariant: () => {},
      e: (x) => x,
      prefix: (x) => x,
      theme: (path, defaultValue) => dlv(config, `theme.${path}`, defaultValue),
      variants: () => [],
      config: (path, defaultValue) => dlv(config, path, defaultValue),
      corePlugins: (path) => {
        if (Array.isArray(config.corePlugins)) {
          return config.corePlugins.includes(path)
        }
        return dlv(config, `corePlugins.${path}`, true)
      },
      target: (path) => {
        if (typeof config.target === 'string') {
          return config.target === 'browserslist' ? browserslistTarget : config.target
        }
        const [defaultTarget, targetOverrides] = dlv(config, 'target')
        const target = dlv(targetOverrides, path, defaultTarget)
        return target === 'browserslist' ? browserslistTarget : target
      },
      postcss,
      ...apiOverrides,
    })
  } catch (_) {}
}

function isAtRule(node: Node): node is AtRule {
  return node.type === 'atrule'
}

function getVariants(state: State): Array<Variant> {
  if (state.jitContext?.getVariants) {
    return state.jitContext.getVariants()
  }

  if (state.jit) {
    let result: Array<Variant> = []
    // [name, [sort, fn]]
    // [name, [[sort, fn]]]
    Array.from(state.jitContext.variantMap as Map<string, [any, any]>).forEach(
      ([variantName, variantFnOrFns]) => {
        result.push({
          name: variantName,
          values: [],
          isArbitrary: false,
          hasDash: true,
          selectors: () => {
            function escape(className: string): string {
              let node = state.modules.postcssSelectorParser.module.className()
              node.value = className
              return dlv(node, 'raws.value', node.value)
            }

            let fns = (Array.isArray(variantFnOrFns[0]) ? variantFnOrFns : [variantFnOrFns]).map(
              ([_sort, fn]) => fn
            )

            let placeholder = '__variant_placeholder__'

            let root = state.modules.postcss.module.root({
              nodes: [
                state.modules.postcss.module.rule({
                  selector: `.${escape(placeholder)}`,
                  nodes: [],
                }),
              ],
            })

            let classNameParser = state.modules.postcssSelectorParser.module((selectors) => {
              return selectors.first.filter(({ type }) => type === 'class').pop().value
            })

            function getClassNameFromSelector(selector) {
              return classNameParser.transformSync(selector)
            }

            function modifySelectors(modifierFunction) {
              root.each((rule) => {
                if (rule.type !== 'rule') {
                  return
                }

                rule.selectors = rule.selectors.map((selector) => {
                  return modifierFunction({
                    get className() {
                      return getClassNameFromSelector(selector)
                    },
                    selector,
                  })
                })
              })
              return root
            }

            let definitions = []

            for (let fn of fns) {
              let definition: string
              let container = root.clone()
              let returnValue = withoutLogs(() =>
                fn({
                  container,
                  separator: state.separator,
                  modifySelectors,
                  format: (def: string) => {
                    definition = def.replace(/:merge\(([^)]+)\)/g, '$1')
                  },
                  wrap: (rule: Container) => {
                    if (isAtRule(rule)) {
                      definition = `@${rule.name} ${rule.params}`
                    }
                  },
                })
              )

              if (!definition) {
                definition = returnValue
              }

              if (definition) {
                definitions.push(definition)
                continue
              }

              container.walkDecls((decl) => {
                decl.remove()
              })

              definition = container
                .toString()
                .replace(`.${escape(`${variantName}:${placeholder}`)}`, '&')
                .replace(/(?<!\\)[{}]/g, '')
                .replace(/\s*\n\s*/g, ' ')
                .trim()

              if (!definition.includes(placeholder)) {
                definitions.push(definition)
              }
            }

            return definitions
          },
        })
      }
    )

    return result
  }

  let config = state.config
  let tailwindcssVersion = state.modules.tailwindcss.version

  let variants = ['responsive', 'hover']
  semver.gte(tailwindcssVersion, '0.3.0') && variants.push('focus', 'group-hover')
  semver.gte(tailwindcssVersion, '0.5.0') && variants.push('active')
  semver.gte(tailwindcssVersion, '0.7.0') && variants.push('focus-within')
  semver.gte(tailwindcssVersion, '1.0.0-beta.1') && variants.push('default')
  semver.gte(tailwindcssVersion, '1.1.0') &&
    variants.push('first', 'last', 'odd', 'even', 'disabled', 'visited')
  semver.gte(tailwindcssVersion, '1.3.0') && variants.push('group-focus')
  semver.gte(tailwindcssVersion, '1.5.0') && variants.push('focus-visible', 'checked')
  semver.gte(tailwindcssVersion, '1.6.0') && variants.push('motion-safe', 'motion-reduce')
  semver.gte(tailwindcssVersion, '2.0.0-alpha.1') && variants.push('dark')

  let plugins = Array.isArray(config.plugins) ? config.plugins : []

  plugins.forEach((plugin) => {
    runPlugin(plugin, state, {
      addVariant: (name) => {
        variants.push(name)
      },
    })
  })

  return variants.map((variant) => ({
    name: variant,
    values: [],
    isArbitrary: false,
    hasDash: true,
    selectors: () => [],
  }))
}

async function getPlugins(config: any) {
  let plugins = config.plugins

  if (!Array.isArray(plugins)) {
    return []
  }

  return Promise.all(
    plugins.map(async (plugin) => {
      let pluginConfig = plugin.config
      if (!isObject(pluginConfig)) {
        pluginConfig = {}
      }

      let contributes = {
        theme: isObject(pluginConfig.theme) ? Object.keys(pluginConfig.theme) : [],
        variants: isObject(pluginConfig.variants) ? Object.keys(pluginConfig.variants) : [],
      }

      const fn = plugin.handler || plugin
      const fnName =
        typeof fn.name === 'string' && fn.name !== 'handler' && fn.name !== '' ? fn.name : null

      try {
        fn()
      } catch (e) {
        const trace = stackTrace.parse(e)
        if (trace.length === 0) {
          return {
            name: fnName,
          }
        }
        const file = trace[0].fileName
        const dir = path.dirname(file)
        let pkgPath = pkgUp.sync({ cwd: dir })
        if (!pkgPath) {
          return {
            name: fnName,
          }
        }
        let pkg: any
        try {
          pkg = require(pkg)
        } catch (_) {
          return {
            name: fnName,
          }
        }
        if (pkg.name && path.resolve(dir, pkg.main || 'index.js') === file) {
          return {
            name: pkg.name,
            homepage: pkg.homepage,
            contributes,
          }
        }
      }
      return {
        name: fnName,
      }
    })
  )
  // try {
  //   return reimport(resolveFrom(tailwindDir, './lib/corePlugins.js'))
  //   return require('./lib/corePlugins.js', tailwindBase).default({
  //     corePlugins: resolvedConfig.corePlugins,
  //   })
  // } catch (_) {
  //   return []
  // }
}

async function getConfigFileFromCssFile(cssFile: string): Promise<string | null> {
  let css = getTextWithoutComments(await fs.promises.readFile(cssFile, 'utf8'), 'css')
  let match = css.match(/@config\s*(?<config>'[^']+'|"[^"]+")/)
  if (!match) {
    return null
  }
  return normalizePath(path.resolve(path.dirname(cssFile), match.groups.config.slice(1, -1)))
}

function getPackageRoot(cwd: string, rootDir: string) {
  try {
    let pkgJsonPath = findUp.sync(
      (dir) => {
        let pkgJson = path.join(dir, 'package.json')
        if (findUp.sync.exists(pkgJson)) {
          return pkgJson
        }
        if (dir === path.normalize(rootDir)) {
          return findUp.stop
        }
      },
      { cwd }
    )
    return pkgJsonPath ? path.dirname(pkgJsonPath) : rootDir
  } catch {
    return rootDir
  }
}

function getContentDocumentSelectorFromConfigFile(
  configPath: string,
  tailwindVersion: string,
  rootDir: string,
  actualConfig?: any
): DocumentSelector[] {
  let config = actualConfig ?? require(configPath)
  let contentConfig: unknown = config.content?.files ?? config.content
  let content = Array.isArray(contentConfig) ? contentConfig : []
  let relativeEnabled = semver.gte(tailwindVersion, '3.2.0')
    ? config.future?.relativeContentPathsByDefault || config.content?.relative
    : false
  let contentBase: string
  if (relativeEnabled) {
    contentBase = path.dirname(configPath)
  } else {
    contentBase = getPackageRoot(path.dirname(configPath), rootDir)
  }
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

class TW {
  private initPromise: Promise<void>
  private lspHandlersAdded = false
  private workspaces: Map<string, { name: string; workspaceFsPath: string }>
  private projects: Map<string, ProjectService>
  private projectCounter: number
  private documentService: DocumentService
  public initializeParams: InitializeParams
  private registrations: Promise<BulkUnregistration>
  private disposables: Disposable[] = []
  private watchPatterns: (patterns: string[]) => void = () => {}
  private watched: string[] = []

  constructor(private connection: Connection) {
    this.documentService = new DocumentService(this.connection)
    this.workspaces = new Map()
    this.projects = new Map()
    this.projectCounter = 0
  }

  async init(): Promise<void> {
    if (!this.initPromise) {
      this.initPromise = this._init()
    }
    await this.initPromise
  }

  private async _init(): Promise<void> {
    clearRequireCache()

    let base: string
    if (this.initializeParams.rootUri) {
      base = URI.parse(this.initializeParams.rootUri).fsPath
    } else if (this.initializeParams.rootPath) {
      base = normalizeFileNameToFsPath(this.initializeParams.rootPath)
    }

    if (!base) {
      console.error('No workspace folders found, not initializing.')
      return
    }

    base = normalizePath(base)

    let workspaceFolders: Array<ProjectConfig> = []
    let globalSettings = await getConfiguration()
    let ignore = globalSettings.tailwindCSS.files.exclude
    let configFileOrFiles = globalSettings.tailwindCSS.experimental.configFile

    let cssFileConfigMap: Map<string, string> = new Map()
    let configTailwindVersionMap: Map<string, string> = new Map()

    // base directory to resolve relative `experimental.configFile` paths against
    let userDefinedConfigBase = this.initializeParams.initializationOptions?.workspaceFile
      ? path.dirname(this.initializeParams.initializationOptions.workspaceFile)
      : base

    if (configFileOrFiles) {
      if (
        typeof configFileOrFiles !== 'string' &&
        (!isObject(configFileOrFiles) ||
          !Object.entries(configFileOrFiles).every(([key, value]) => {
            if (typeof key !== 'string') return false
            if (Array.isArray(value)) {
              return value.every((item) => typeof item === 'string')
            }
            return typeof value === 'string'
          }))
      ) {
        console.error('Invalid `experimental.configFile` configuration, not initializing.')
        return
      }

      let configFiles =
        typeof configFileOrFiles === 'string'
          ? { [configFileOrFiles]: path.resolve(base, '**') }
          : configFileOrFiles

      workspaceFolders = Object.entries(configFiles).map(
        ([relativeConfigPath, relativeDocumentSelectorOrSelectors]) => {
          return {
            folder: base,
            configPath: normalizePath(path.resolve(userDefinedConfigBase, relativeConfigPath)),
            documentSelector: [].concat(relativeDocumentSelectorOrSelectors).map((selector) => ({
              priority: DocumentSelectorPriority.USER_CONFIGURED,
              pattern: normalizePath(path.resolve(userDefinedConfigBase, selector)),
            })),
            isUserConfigured: true,
          }
        }
      )
    } else {
      let projects: Record<string, Array<DocumentSelector>> = {}

      let files = await glob([`**/${CONFIG_GLOB}`, `**/${CSS_GLOB}`], {
        cwd: base,
        ignore: (await getConfiguration()).tailwindCSS.files.exclude,
        onlyFiles: true,
        absolute: true,
        suppressErrors: true,
        dot: true,
        concurrency: Math.max(os.cpus().length, 1),
      })

      for (let filename of files) {
        let normalizedFilename = normalizePath(filename)
        let isCssFile = minimatch(normalizedFilename, `**/${CSS_GLOB}`, { dot: true })
        let configPath = isCssFile ? await getConfigFileFromCssFile(filename) : filename
        if (!configPath) {
          continue
        }

        let twVersion = require('tailwindcss/package.json').version
        let isDefaultVersion = true
        try {
          let v = require(resolveFrom(path.dirname(configPath), 'tailwindcss/package.json')).version
          if (typeof v === 'string') {
            twVersion = v
            isDefaultVersion = false
          }
        } catch {}

        if (isCssFile && (!semver.gte(twVersion, '3.2.0') || isDefaultVersion)) {
          continue
        }

        if (
          (configPath.endsWith('.ts') || configPath.endsWith('.mjs')) &&
          !semver.gte(twVersion, '3.3.0')
        ) {
          continue
        }

        configTailwindVersionMap.set(configPath, twVersion)

        let contentSelector: Array<DocumentSelector> = []
        try {
          contentSelector = getContentDocumentSelectorFromConfigFile(configPath, twVersion, base)
        } catch {}

        let documentSelector: DocumentSelector[] = [
          {
            pattern: normalizePath(filename),
            priority: isCssFile
              ? DocumentSelectorPriority.CSS_FILE
              : DocumentSelectorPriority.CONFIG_FILE,
          },
          ...(isCssFile
            ? [
                {
                  pattern: normalizePath(configPath),
                  priority: DocumentSelectorPriority.CONFIG_FILE,
                },
              ]
            : []),
          ...contentSelector,
          {
            pattern: normalizePath(path.join(path.dirname(filename), '**')),
            priority: isCssFile
              ? DocumentSelectorPriority.CSS_DIRECTORY
              : DocumentSelectorPriority.CONFIG_DIRECTORY,
          },
          ...(isCssFile
            ? [
                {
                  pattern: normalizePath(path.join(path.dirname(configPath), '**')),
                  priority: DocumentSelectorPriority.CONFIG_DIRECTORY,
                },
              ]
            : []),
          {
            pattern: normalizePath(path.join(getPackageRoot(path.dirname(configPath), base), '**')),
            priority: DocumentSelectorPriority.PACKAGE_DIRECTORY,
          },
        ]

        projects[configPath] = [...(projects[configPath] ?? []), ...documentSelector]

        if (isCssFile) {
          cssFileConfigMap.set(normalizedFilename, configPath)
        }
      }

      let projectKeys = Object.keys(projects)
      let projectCount = projectKeys.length

      if (projectCount > 0) {
        if (projectCount === 1) {
          projects[projectKeys[0]].push({
            pattern: normalizePath(path.join(base, '**')),
            priority: DocumentSelectorPriority.ROOT_DIRECTORY,
          })
        }
        workspaceFolders = Object.entries(projects).map(([configPath, documentSelector]) => {
          return {
            folder: base,
            configPath,
            isUserConfigured: false,
            documentSelector: documentSelector
              .sort((a, z) => a.priority - z.priority)
              .filter(
                ({ pattern }, index, documentSelectors) =>
                  documentSelectors.findIndex(({ pattern: p }) => p === pattern) === index
              ),
          }
        })
      }
    }

    console.log(`[Global] Creating projects: ${JSON.stringify(workspaceFolders)}`)

    const onDidChangeWatchedFiles = async (
      changes: Array<{ file: string; type: FileChangeType }>
    ): Promise<void> => {
      let needsRestart = false

      changeLoop: for (let change of changes) {
        let normalizedFilename = normalizePath(change.file)

        for (let ignorePattern of ignore) {
          if (minimatch(normalizedFilename, ignorePattern, { dot: true })) {
            continue changeLoop
          }
        }

        let isPackageFile = minimatch(normalizedFilename, `**/${PACKAGE_LOCK_GLOB}`, { dot: true })
        if (isPackageFile) {
          for (let [, project] of this.projects) {
            let twVersion = require('tailwindcss/package.json').version
            try {
              let v = require(resolveFrom(
                path.dirname(project.projectConfig.configPath),
                'tailwindcss/package.json'
              )).version
              if (typeof v === 'string') {
                twVersion = v
              }
            } catch {}
            if (configTailwindVersionMap.get(project.projectConfig.configPath) !== twVersion) {
              needsRestart = true
              break changeLoop
            }
          }
        }

        let isCssFile = minimatch(normalizedFilename, `**/${CSS_GLOB}`, {
          dot: true,
        })
        if (isCssFile && change.type !== FileChangeType.Deleted) {
          let configPath = await getConfigFileFromCssFile(change.file)
          if (
            cssFileConfigMap.has(normalizedFilename) &&
            cssFileConfigMap.get(normalizedFilename) !== configPath
          ) {
            needsRestart = true
            break
          } else if (!cssFileConfigMap.has(normalizedFilename) && configPath) {
            needsRestart = true
            break
          }
        }

        let isConfigFile = minimatch(normalizedFilename, `**/${CONFIG_GLOB}`, {
          dot: true,
        })
        if (isConfigFile && change.type === FileChangeType.Created) {
          needsRestart = true
          break
        }

        for (let [, project] of this.projects) {
          if (
            change.type === FileChangeType.Deleted &&
            changeAffectsFile(normalizedFilename, [project.projectConfig.configPath])
          ) {
            needsRestart = true
            break changeLoop
          }
        }
      }

      if (needsRestart) {
        this.restart()
        return
      }

      for (let [, project] of this.projects) {
        project.onFileEvents(changes)
      }
    }

    if (this.initializeParams.capabilities.workspace?.didChangeWatchedFiles?.dynamicRegistration) {
      this.disposables.push(
        this.connection.onDidChangeWatchedFiles(async ({ changes }) => {
          let normalizedChanges = changes
            .map(({ uri, type }) => ({
              file: URI.parse(uri).fsPath,
              type,
            }))
            .filter(
              (change, changeIndex, changes) =>
                changes.findIndex((c) => c.file === change.file && c.type === change.type) ===
                changeIndex
            )

          await onDidChangeWatchedFiles(normalizedChanges)
        })
      )

      let disposable = await this.connection.client.register(
        DidChangeWatchedFilesNotification.type,
        {
          watchers: [
            { globPattern: `**/${CONFIG_GLOB}` },
            { globPattern: `**/${PACKAGE_LOCK_GLOB}` },
            { globPattern: `**/${CSS_GLOB}` },
          ],
        }
      )

      this.disposables.push(disposable)

      this.watchPatterns = (patterns) => {
        let newPatterns = this.filterNewWatchPatterns(patterns)
        if (newPatterns.length) {
          console.log(`[Global] Adding watch patterns: ${newPatterns.join(', ')}`)
          this.connection.client
            .register(DidChangeWatchedFilesNotification.type, {
              watchers: newPatterns.map((pattern) => ({ globPattern: pattern })),
            })
            .then((disposable) => {
              this.disposables.push(disposable)
            })
        }
      }
    } else if (parcel.getBinding()) {
      let typeMap = {
        create: FileChangeType.Created,
        update: FileChangeType.Changed,
        delete: FileChangeType.Deleted,
      }

      let subscription = await parcel.subscribe(
        base,
        (err, events) => {
          onDidChangeWatchedFiles(
            events.map((event) => ({ file: event.path, type: typeMap[event.type] }))
          )
        },
        {
          ignore: ignore.map((ignorePattern) =>
            path.resolve(base, ignorePattern.replace(/^[*/]+/, '').replace(/[*/]+$/, ''))
          ),
        }
      )

      this.disposables.push({
        dispose() {
          subscription.unsubscribe()
        },
      })
    } else {
      let watch: typeof chokidar.watch = require('chokidar').watch
      let chokidarWatcher = watch(
        [`**/${CONFIG_GLOB}`, `**/${PACKAGE_LOCK_GLOB}`, `**/${CSS_GLOB}`],
        {
          cwd: base,
          ignorePermissionErrors: true,
          ignoreInitial: true,
          ignored: ignore,
          awaitWriteFinish: {
            stabilityThreshold: 100,
            pollInterval: 20,
          },
        }
      )

      await new Promise<void>((resolve) => {
        chokidarWatcher.on('ready', () => resolve())
      })

      chokidarWatcher
        .on('add', (file) =>
          onDidChangeWatchedFiles([
            { file: path.resolve(base, file), type: FileChangeType.Created },
          ])
        )
        .on('change', (file) =>
          onDidChangeWatchedFiles([
            { file: path.resolve(base, file), type: FileChangeType.Changed },
          ])
        )
        .on('unlink', (file) =>
          onDidChangeWatchedFiles([
            { file: path.resolve(base, file), type: FileChangeType.Deleted },
          ])
        )

      this.disposables.push({
        dispose() {
          chokidarWatcher.close()
        },
      })

      this.watchPatterns = (patterns) => {
        let newPatterns = this.filterNewWatchPatterns(patterns)
        if (newPatterns.length) {
          console.log(`[Global] Adding watch patterns: ${newPatterns.join(', ')}`)
          chokidarWatcher.add(newPatterns)
        }
      }
    }

    await Promise.all(
      workspaceFolders.map((projectConfig) =>
        this.addProject(
          projectConfig,
          this.initializeParams,
          this.watchPatterns,
          configTailwindVersionMap.get(projectConfig.configPath)
        )
      )
    )

    // init projects for documents that are _already_ open
    for (let document of this.documentService.getAllDocuments()) {
      let project = this.getProject(document)
      if (project && !project.enabled()) {
        project.enable()
        await project.tryInit()
      }
    }

    this.setupLSPHandlers()

    this.disposables.push(
      this.connection.onDidChangeConfiguration(async ({ settings }) => {
        let previousExclude = globalSettings.tailwindCSS.files.exclude

        documentSettingsCache.clear()
        globalSettings = await getConfiguration()

        if (!equal(previousExclude, globalSettings.tailwindCSS.files.exclude)) {
          this.restart()
          return
        }

        for (let [, project] of this.projects) {
          project.onUpdateSettings(settings)
        }
      })
    )

    this.disposables.push(
      this.connection.onShutdown(() => {
        this.dispose()
      })
    )

    this.disposables.push(
      this.documentService.onDidChangeContent((change) => {
        this.getProject(change.document)?.provideDiagnostics(change.document)
      })
    )

    this.disposables.push(
      this.documentService.onDidOpen((event) => {
        let project = this.getProject(event.document)
        if (project && !project.enabled()) {
          project.enable()
          project.tryInit()
        }
      })
    )
  }

  private filterNewWatchPatterns(patterns: string[]) {
    let newWatchPatterns = patterns.filter((pattern) => !this.watched.includes(pattern))
    this.watched.push(...newWatchPatterns)
    return newWatchPatterns
  }

  private async addProject(
    projectConfig: ProjectConfig,
    params: InitializeParams,
    watchPatterns: (patterns: string[]) => void,
    tailwindVersion: string
  ): Promise<void> {
    let key = String(this.projectCounter++)
    const project = await createProjectService(
      key,
      projectConfig,
      this.connection,
      params,
      this.documentService,
      () => this.updateCapabilities(),
      () => {
        for (let document of this.documentService.getAllDocuments()) {
          let project = this.getProject(document)
          if (project && !project.enabled()) {
            project.enable()
            project.tryInit()
            break
          }
        }
      },
      () => this.refreshDiagnostics(),
      (patterns: string[]) => watchPatterns(patterns),
      tailwindVersion
    )
    this.projects.set(key, project)
  }

  private refreshDiagnostics() {
    for (let doc of this.documentService.getAllDocuments()) {
      let project = this.getProject(doc)
      if (project) {
        project.provideDiagnosticsForce(doc)
      } else {
        this.connection.sendDiagnostics({ uri: doc.uri, diagnostics: [] })
      }
    }
  }

  setupLSPHandlers() {
    if (this.lspHandlersAdded) {
      return
    }
    this.lspHandlersAdded = true

    this.connection.onHover(this.onHover.bind(this))
    this.connection.onCompletion(this.onCompletion.bind(this))
    this.connection.onCompletionResolve(this.onCompletionResolve.bind(this))
    this.connection.onDocumentColor(this.onDocumentColor.bind(this))
    this.connection.onColorPresentation(this.onColorPresentation.bind(this))
    this.connection.onCodeAction(this.onCodeAction.bind(this))
    this.connection.onDocumentLinks(this.onDocumentLinks.bind(this))
    this.connection.onRequest(this.onRequest.bind(this))
  }

  private onRequest(
    method: '@/tailwindCSS/sortSelection',
    params: { uri: string; classLists: string[] }
  ): { error: string } | { classLists: string[] }
  private onRequest(
    method: '@/tailwindCSS/getProject',
    params: { uri: string }
  ): { version: string } | null
  private onRequest(method: string, params: any): any {
    if (method === '@/tailwindCSS/sortSelection') {
      let project = this.getProject({ uri: params.uri })
      if (!project) {
        return { error: 'no-project' }
      }
      try {
        return { classLists: project.sortClassLists(params.classLists) }
      } catch {
        return { error: 'unknown' }
      }
    }

    if (method === '@/tailwindCSS/getProject') {
      let project = this.getProject({ uri: params.uri })
      if (!project || !project.enabled() || !project.state?.enabled) {
        return null
      }
      return {
        version: project.state.version,
      }
    }
  }

  private updateCapabilities() {
    if (!supportsDynamicRegistration(this.initializeParams)) {
      return
    }

    if (this.registrations) {
      this.registrations.then((r) => r.dispose())
    }

    let projects = Array.from(this.projects.values())

    let capabilities = BulkRegistration.create()

    capabilities.add(HoverRequest.type, { documentSelector: null })
    capabilities.add(DocumentColorRequest.type, { documentSelector: null })
    capabilities.add(CodeActionRequest.type, { documentSelector: null })
    capabilities.add(DocumentLinkRequest.type, { documentSelector: null })

    capabilities.add(CompletionRequest.type, {
      documentSelector: null,
      resolveProvider: true,
      triggerCharacters: [
        ...TRIGGER_CHARACTERS,
        ...projects
          .map((project) => project.state.separator)
          .filter((sep) => typeof sep === 'string')
          .map((sep) => sep.slice(-1)),
      ].filter(Boolean),
    })

    this.registrations = this.connection.client.register(capabilities)
  }

  private getProject(document: TextDocumentIdentifier): ProjectService {
    let fallbackProject: ProjectService
    let matchedProject: ProjectService
    let matchedPriority: number = Infinity

    for (let [, project] of this.projects) {
      if (project.projectConfig.configPath) {
        let documentSelector = project
          .documentSelector()
          .concat()
          // move all the negated patterns to the front
          .sort((a, z) => {
            if (a.pattern.startsWith('!') && !z.pattern.startsWith('!')) {
              return -1
            }
            if (!a.pattern.startsWith('!') && z.pattern.startsWith('!')) {
              return 1
            }
            return 0
          })
        for (let selector of documentSelector) {
          let fsPath = URI.parse(document.uri).fsPath
          let pattern = selector.pattern.replace(/[\[\]{}]/g, (m) => `\\${m}`)
          if (pattern.startsWith('!') && minimatch(fsPath, pattern.slice(1), { dot: true })) {
            break
          }
          if (minimatch(fsPath, pattern, { dot: true }) && selector.priority < matchedPriority) {
            matchedProject = project
            matchedPriority = selector.priority
          }
        }
      } else {
        if (!fallbackProject) {
          fallbackProject = project
        }
      }
    }

    if (matchedProject) {
      return matchedProject
    }

    return fallbackProject
  }

  async onDocumentColor(params: DocumentColorParams): Promise<ColorInformation[]> {
    await this.init()
    return this.getProject(params.textDocument)?.onDocumentColor(params) ?? []
  }

  async onColorPresentation(params: ColorPresentationParams): Promise<ColorPresentation[]> {
    await this.init()
    return this.getProject(params.textDocument)?.onColorPresentation(params) ?? []
  }

  async onHover(params: TextDocumentPositionParams): Promise<Hover> {
    await this.init()
    return this.getProject(params.textDocument)?.onHover(params) ?? null
  }

  async onCompletion(params: CompletionParams): Promise<CompletionList> {
    await this.init()
    return this.getProject(params.textDocument)?.onCompletion(params) ?? null
  }

  async onCompletionResolve(item: CompletionItem): Promise<CompletionItem> {
    await this.init()
    return this.projects.get(item.data?._projectKey)?.onCompletionResolve(item) ?? null
  }

  async onCodeAction(params: CodeActionParams): Promise<CodeAction[]> {
    await this.init()
    return this.getProject(params.textDocument)?.onCodeAction(params) ?? null
  }

  async onDocumentLinks(params: DocumentLinkParams): Promise<DocumentLink[]> {
    await this.init()
    return this.getProject(params.textDocument)?.onDocumentLinks(params) ?? null
  }

  listen() {
    this.connection.listen()
  }

  dispose(): void {
    connection.sendNotification('@/tailwindCSS/projectsDestroyed')
    for (let [, project] of this.projects) {
      project.dispose()
    }
    this.projects = new Map()

    this.refreshDiagnostics()

    if (this.registrations) {
      this.registrations.then((r) => r.dispose())
      this.registrations = undefined
    }

    this.disposables.forEach((d) => d.dispose())
    this.disposables.length = 0

    this.watched.length = 0
  }

  restart(): void {
    console.log('----------\nRESTARTING\n----------')
    this.dispose()
    this.initPromise = undefined
    this.init()
  }
}

class DocumentService {
  public documents: TextDocuments<TextDocument>

  constructor(conn: Connection) {
    this.documents = new TextDocuments(TextDocument)
    this.documents.listen(conn)
  }

  getDocument(uri: string) {
    return this.documents.get(uri)
  }

  getAllDocuments() {
    return this.documents.all()
  }

  get onDidChangeContent() {
    return this.documents.onDidChangeContent
  }
  get onDidClose() {
    return this.documents.onDidClose
  }
  get onDidOpen() {
    return this.documents.onDidOpen
  }
}

function supportsDynamicRegistration(params: InitializeParams): boolean {
  return (
    params.capabilities.textDocument.hover?.dynamicRegistration &&
    params.capabilities.textDocument.colorProvider?.dynamicRegistration &&
    params.capabilities.textDocument.codeAction?.dynamicRegistration &&
    params.capabilities.textDocument.completion?.dynamicRegistration &&
    params.capabilities.textDocument.documentLink?.dynamicRegistration
  )
}

const tw = new TW(connection)

connection.onInitialize(async (params: InitializeParams): Promise<InitializeResult> => {
  tw.initializeParams = params

  if (supportsDynamicRegistration(params)) {
    return {
      capabilities: {
        textDocumentSync: TextDocumentSyncKind.Full,
      },
    }
  }

  tw.setupLSPHandlers()

  return {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Full,
      hoverProvider: true,
      colorProvider: true,
      codeActionProvider: true,
      documentLinkProvider: {},
      completionProvider: {
        resolveProvider: true,
        triggerCharacters: [...TRIGGER_CHARACTERS, ':'],
      },
    },
  }
})

connection.onInitialized(async () => {
  await tw.init()
})

tw.listen()
