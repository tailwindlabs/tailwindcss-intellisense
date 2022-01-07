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
import semver from 'semver'
import dlv from 'dlv'
import dset from 'dset'
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
} from 'tailwindcss-language-service/src/util/state'
import {
  provideDiagnostics,
  updateAllDiagnostics,
  clearAllDiagnostics,
} from './lsp/diagnosticsProvider'
import { doCodeActions } from 'tailwindcss-language-service/src/codeActions/codeActionProvider'
import { getDocumentColors } from 'tailwindcss-language-service/src/documentColorProvider'
import { debounce } from 'debounce'
import { getModuleDependencies } from './util/getModuleDependencies'
import assert from 'assert'
// import postcssLoadConfig from 'postcss-load-config'
import * as parcel from './watcher/index.js'
import { generateRules } from 'tailwindcss-language-service/src/util/jit'
import { getColor } from 'tailwindcss-language-service/src/util/color'
import * as culori from 'culori'
import namedColors from 'color-name'
import preflight from './lib/preflight'
import tailwindPlugins from './lib/plugins'

let oldReadFileSync = fs.readFileSync
// @ts-ignore
fs.readFileSync = function (filename, ...args) {
  if (filename === path.join(__dirname, 'css/preflight.css')) {
    return preflight
  }
  return oldReadFileSync(filename, ...args)
}

const CONFIG_FILE_GLOB = '{tailwind,tailwind.config}.{js,cjs}'
const PACKAGE_GLOB = '{package.json,package-lock.json,yarn.lock,pnpm-lock.yaml}'
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
  '[',
  // JIT "important" prefix
  '!',
  // JIT opacity modifiers
  '/',
] as const

const colorNames = Object.keys(namedColors)

declare var __non_webpack_require__: typeof require

const connection =
  process.argv.length <= 2 ? createConnection(process.stdin, process.stdout) : createConnection()

console.log = connection.console.log.bind(connection.console)
console.error = connection.console.error.bind(connection.console)

process.on('unhandledRejection', (e: any) => {
  connection.console.error(formatError(`Unhandled exception`, e))
})

function normalizeFileNameToFsPath(fileName: string) {
  return URI.file(fileName).fsPath
}

function getFileFsPath(documentUri: string): string {
  return URI.parse(documentUri).fsPath
}

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
  state: State
  tryInit: () => Promise<void>
  dispose: () => void
  onUpdateSettings: (settings: any) => void
  onHover(params: TextDocumentPositionParams): Promise<Hover>
  onCompletion(params: CompletionParams): Promise<CompletionList>
  onCompletionResolve(item: CompletionItem): Promise<CompletionItem>
  provideDiagnostics(document: TextDocument): void
  onDocumentColor(params: DocumentColorParams): Promise<ColorInformation[]>
  onColorPresentation(params: ColorPresentationParams): Promise<ColorPresentation[]>
  onCodeAction(params: CodeActionParams): Promise<CodeAction[]>
}

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

async function createProjectService(
  folder: string,
  connection: Connection,
  params: InitializeParams,
  documentService: DocumentService
): Promise<ProjectService> {
  const disposables: Disposable[] = []
  const state: State = {
    enabled: false,
    editor: {
      connection,
      globalSettings: params.initializationOptions.configuration as Settings,
      userLanguages: params.initializationOptions.userLanguages
        ? params.initializationOptions.userLanguages
        : {},
      // TODO
      capabilities: {
        configuration: true,
        diagnosticRelatedInformation: true,
      },
      documents: documentService.documents,
      getConfiguration: async (uri?: string) => {
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
        let config: Settings = { editor, tailwindCSS }
        documentSettingsCache.set(uri, config)
        return config
      },
      getDocumentSymbols: (uri: string) => {
        return connection.sendRequest('@/tailwindCSS/getDocumentSymbols', { uri })
      },
    },
  }

  const documentSettingsCache: Map<string, Settings> = new Map()
  let registrations: Promise<BulkUnregistration>

  let chokidarWatcher: chokidar.FSWatcher
  let ignore = [
    '**/.git/objects/**',
    '**/.git/subtree-cache/**',
    '**/node_modules/**',
    '**/.hg/store/**',
  ]

  function onFileEvents(changes: Array<{ file: string; type: FileChangeType }>): void {
    let needsInit = false
    let needsRebuild = false

    for (let change of changes) {
      let file = normalizePath(change.file)

      for (let ignorePattern of ignore) {
        if (minimatch(file, ignorePattern, { dot: true })) {
          continue
        }
      }

      let isConfigFile = minimatch(file, `**/${CONFIG_FILE_GLOB}`, { dot: true })
      let isPackageFile = minimatch(file, `**/${PACKAGE_GLOB}`, { dot: true })
      let isDependency = state.dependencies && state.dependencies.includes(change.file)

      if (!isConfigFile && !isPackageFile && !isDependency) continue

      if (change.type === FileChangeType.Created) {
        needsInit = true
        break
      } else if (change.type === FileChangeType.Changed) {
        if (!state.enabled || isPackageFile) {
          needsInit = true
          break
        } else {
          needsRebuild = true
        }
      } else if (change.type === FileChangeType.Deleted) {
        if (!state.enabled || isPackageFile || isConfigFile) {
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

  if (params.capabilities.workspace?.didChangeWatchedFiles?.dynamicRegistration) {
    connection.onDidChangeWatchedFiles(({ changes }) => {
      onFileEvents(
        changes.map(({ uri, type }) => ({
          file: URI.parse(uri).fsPath,
          type,
        }))
      )
    })

    connection.client.register(DidChangeWatchedFilesNotification.type, {
      watchers: [{ globPattern: `**/${CONFIG_FILE_GLOB}` }, { globPattern: `**/${PACKAGE_GLOB}` }],
    })
  } else if (parcel.getBinding()) {
    let typeMap = {
      create: FileChangeType.Created,
      update: FileChangeType.Changed,
      delete: FileChangeType.Deleted,
    }

    let subscription = await parcel.subscribe(
      folder,
      (err, events) => {
        onFileEvents(events.map((event) => ({ file: event.path, type: typeMap[event.type] })))
      },
      {
        ignore: ignore.map((ignorePattern) =>
          path.resolve(folder, ignorePattern.replace(/^[*/]+/, '').replace(/[*/]+$/, ''))
        ),
      }
    )

    disposables.push({
      dispose() {
        subscription.unsubscribe()
      },
    })
  } else {
    let watch: typeof chokidar.watch = require('chokidar').watch
    chokidarWatcher = watch([`**/${CONFIG_FILE_GLOB}`, `**/${PACKAGE_GLOB}`], {
      cwd: folder,
      ignorePermissionErrors: true,
      ignoreInitial: true,
      ignored: ignore,
      awaitWriteFinish: {
        stabilityThreshold: 100,
        pollInterval: 20,
      },
    })

    await new Promise<void>((resolve) => {
      chokidarWatcher.on('ready', () => resolve())
    })

    chokidarWatcher
      .on('add', (file) => onFileEvents([{ file, type: FileChangeType.Created }]))
      .on('change', (file) => onFileEvents([{ file, type: FileChangeType.Changed }]))
      .on('unlink', (file) => onFileEvents([{ file, type: FileChangeType.Deleted }]))

    disposables.push({
      dispose() {
        chokidarWatcher.close()
      },
    })
  }

  function registerCapabilities(watchFiles: string[] = []): void {
    if (supportsDynamicRegistration(connection, params)) {
      if (registrations) {
        registrations.then((r) => r.dispose())
      }

      let capabilities = BulkRegistration.create()

      capabilities.add(HoverRequest.type, {
        documentSelector: null,
      })
      capabilities.add(DocumentColorRequest.type, {
        documentSelector: null,
      })
      capabilities.add(CodeActionRequest.type, {
        documentSelector: null,
      })
      capabilities.add(CompletionRequest.type, {
        documentSelector: null,
        resolveProvider: true,
        triggerCharacters: [...TRIGGER_CHARACTERS, state.separator],
      })
      if (watchFiles.length > 0) {
        capabilities.add(DidChangeWatchedFilesNotification.type, {
          watchers: watchFiles.map((file) => ({ globPattern: file })),
        })
      }

      registrations = connection.client.register(capabilities)
    }
  }

  function resetState(): void {
    clearAllDiagnostics(state)
    Object.keys(state).forEach((key) => {
      // Keep `dependencies` to ensure that they are still watched
      if (key !== 'editor' && key !== 'dependencies') {
        delete state[key]
      }
    })
    state.enabled = false
    registerCapabilities(state.dependencies)
  }

  async function tryInit() {
    try {
      await init()
    } catch (error) {
      resetState()
      showError(connection, error)
    }
  }

  async function tryRebuild() {
    try {
      await rebuild()
    } catch (error) {
      resetState()
      showError(connection, error)
    }
  }

  function clearRequireCache(): void {
    Object.keys(__non_webpack_require__.cache).forEach((key) => {
      if (!key.endsWith('.node')) {
        delete __non_webpack_require__.cache[key]
      }
    })
    Object.keys((Module as any)._pathCache).forEach((key) => {
      delete (Module as any)._pathCache[key]
    })
  }

  async function init() {
    clearRequireCache()

    let [configPath] = (
      await glob([`**/${CONFIG_FILE_GLOB}`], {
        cwd: folder,
        ignore: ['**/node_modules'],
        onlyFiles: true,
        absolute: true,
        suppressErrors: true,
        dot: true,
        concurrency: Math.max(os.cpus().length, 1),
      })
    )
      .sort((a: string, b: string) => a.split('/').length - b.split('/').length)
      .map(path.normalize)

    if (!configPath) {
      throw new SilentError('No config file found.')
    }

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
        if (dir === folder) {
          return findUp.stop
        }
      },
      { cwd: folder }
    )

    if (pnpPath) {
      let pnpApi = __non_webpack_require__(pnpPath)
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

      postcssVersion = __non_webpack_require__(postcssPkgPath).version
      tailwindcssVersion = __non_webpack_require__(tailwindcssPkgPath).version

      pluginVersions = Object.keys(tailwindPlugins)
        .map((plugin) => {
          try {
            return __non_webpack_require__(resolveFrom(configDir, `${plugin}/package.json`)).version
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
        console.log('short circuit')
        return
      }

      console.log(`Found Tailwind CSS config file: ${configPath}`)

      postcss = __non_webpack_require__(postcssPath)
      postcssSelectorParser = __non_webpack_require__(postcssSelectorParserPath)
      console.log(`Loaded postcss v${postcssVersion}: ${postcssDir}`)

      tailwindcss = __non_webpack_require__(tailwindcssPath)
      console.log(`Loaded tailwindcss v${tailwindcssVersion}: ${tailwindDir}`)

      try {
        resolveConfigFn = __non_webpack_require__(resolveFrom(tailwindDir, './resolveConfig.js'))
      } catch (_) {
        try {
          const resolveConfig = __non_webpack_require__(
            resolveFrom(tailwindDir, './lib/util/resolveConfig.js')
          )
          const defaultConfig = __non_webpack_require__(
            resolveFrom(tailwindDir, './stubs/defaultConfig.stub.js')
          )
          resolveConfigFn = (config) => resolveConfig([config, defaultConfig])
        } catch (_) {
          try {
            const resolveConfig = __non_webpack_require__(
              resolveFrom(tailwindDir, './lib/util/mergeConfigWithDefaults.js')
            )
            const defaultConfig = __non_webpack_require__(
              resolveFrom(tailwindDir, './defaultConfig.js')
            )
            resolveConfigFn = (config) => resolveConfig(config, defaultConfig())
          } catch (_) {
            throw Error('Failed to load resolveConfig function.')
          }
        }
      }

      if (semver.gte(tailwindcssVersion, '1.4.0') && semver.lte(tailwindcssVersion, '1.99.0')) {
        const browserslistPath = resolveFrom(tailwindDir, 'browserslist')
        // TODO: set path to nearest dir with package.json?
        browserslist = __non_webpack_require__(browserslistPath)(undefined, { path: folder })
      }

      if (semver.gte(tailwindcssVersion, '1.99.0')) {
        applyComplexClasses = firstOptional(() =>
          __non_webpack_require__(resolveFrom(tailwindDir, './lib/lib/substituteClassApplyAtRules'))
        )
      } else if (semver.gte(tailwindcssVersion, '1.7.0')) {
        applyComplexClasses = __non_webpack_require__(
          resolveFrom(tailwindDir, './lib/flagged/applyComplexClasses')
        )
      }

      try {
        featureFlags = __non_webpack_require__(
          resolveFrom(tailwindDir, './lib/featureFlags.js')
        ).default
      } catch (_) {}

      // stubs
      let tailwindDirectives = new Set()
      let root = postcss.root()
      let result = { opts: {}, messages: [] }
      let registerDependency = () => {}

      try {
        let createContext = first(
          () => {
            let createContextFn = __non_webpack_require__(
              resolveFrom(configDir, 'tailwindcss/lib/lib/setupContextUtils')
            ).createContext
            assert.strictEqual(typeof createContextFn, 'function')
            return (state) => createContextFn(state.config)
          },
          () => {
            let createContextFn = __non_webpack_require__(
              resolveFrom(configDir, 'tailwindcss/lib/jit/lib/setupContextUtils')
            ).createContext
            assert.strictEqual(typeof createContextFn, 'function')
            return (state) => createContextFn(state.config)
          },
          // TODO: the next two are canary releases only so can probably be removed
          () => {
            let setupTrackingContext = __non_webpack_require__(
              resolveFrom(configDir, 'tailwindcss/lib/jit/lib/setupTrackingContext')
            ).default
            assert.strictEqual(typeof setupTrackingContext, 'function')
            return (state) =>
              setupTrackingContext(
                state.configPath,
                tailwindDirectives,
                registerDependency
              )(result, root)
          },
          () => {
            let setupContext = __non_webpack_require__(
              resolveFrom(configDir, 'tailwindcss/lib/jit/lib/setupContext')
            ).default
            assert.strictEqual(typeof setupContext, 'function')
            return (state) => setupContext(state.configPath, tailwindDirectives)(result, root)
          }
        )

        jitModules = {
          generateRules: {
            module: first(
              () =>
                __non_webpack_require__(resolveFrom(configDir, 'tailwindcss/lib/lib/generateRules'))
                  .generateRules,
              () =>
                __non_webpack_require__(
                  resolveFrom(configDir, 'tailwindcss/lib/jit/lib/generateRules')
                ).generateRules
            ),
          },
          createContext: {
            module: createContext,
          },
          expandApplyAtRules: {
            module: first(
              () =>
                __non_webpack_require__(
                  resolveFrom(configDir, 'tailwindcss/lib/lib/expandApplyAtRules')
                ).default,
              () =>
                __non_webpack_require__(
                  resolveFrom(configDir, 'tailwindcss/lib/jit/lib/expandApplyAtRules')
                ).default
            ),
          },
        }
      } catch (_) {
        try {
          let setupContext = __non_webpack_require__(
            resolveFrom(configDir, 'tailwindcss/jit/lib/setupContext')
          )

          jitModules = {
            generateRules: {
              module: __non_webpack_require__(
                resolveFrom(configDir, 'tailwindcss/jit/lib/generateRules')
              ).generateRules,
            },
            createContext: {
              module: (state) => setupContext(state.configPath, tailwindDirectives)(result, root),
            },
            expandApplyAtRules: {
              module: __non_webpack_require__(
                resolveFrom(configDir, 'tailwindcss/jit/lib/expandApplyAtRules')
              ),
            },
          }
        } catch (_) {}
      }
    } catch (error) {
      tailwindcss = require('tailwindcss')
      resolveConfigFn = require('tailwindcss/resolveConfig')
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
      console.log('Failed to load workspace modules.')
      console.log(`Using bundled version of \`tailwindcss\`: v${tailwindcssVersion}`)
      console.log(`Using bundled version of \`postcss\`: v${postcssVersion}`)
    }

    state.configPath = configPath
    state.modules = {
      tailwindcss: { version: tailwindcssVersion, module: tailwindcss },
      postcss: { version: postcssVersion, module: postcss },
      postcssSelectorParser: { module: postcssSelectorParser },
      resolveConfig: { module: resolveConfigFn },
      jit: jitModules,
    }
    state.browserslist = browserslist
    state.featureFlags = featureFlags
    state.version = tailwindcssVersion
    state.pluginVersions = pluginVersions

    try {
      state.corePlugins = Object.keys(
        __non_webpack_require__(
          resolveFrom(path.dirname(state.configPath), 'tailwindcss/lib/plugins/index.js')
        )
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
    clearRequireCache()

    const { tailwindcss, postcss, resolveConfig } = state.modules
    const sepLocation = semver.gte(tailwindcss.version, '0.99.0')
      ? ['separator']
      : ['options', 'separator']
    let presetVariants: any[] = []
    let originalConfig: any

    let isV3 = semver.gte(tailwindcss.version, '2.99.0')

    let hook = new Hook(fs.realpathSync(state.configPath), (exports) => {
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
      __non_webpack_require__(state.configPath)
    } catch (error) {
      hook.unhook()
      throw error
    }

    if (!originalConfig) {
      throw new SilentError(`Failed to load config file: ${state.configPath}`)
    }

    try {
      state.config = resolveConfig.module(originalConfig)
      state.separator = state.config.separator

      if (state.jit) {
        state.jitContext = state.modules.jit.createContext.module(state)
        state.jitContext.tailwindConfig.separator = state.config.separator
        if (state.jitContext.getClassList) {
          state.classList = state.jitContext
            .getClassList()
            .filter((className) => className !== '*')
            .map((className) => {
              return [className, { color: getColor(state, className) }]
            })
        }
      } else {
        delete state.jitContext
        delete state.classList
      }
    } catch (error) {
      hook.unhook()
      throw error
    }

    let postcssResult: Result

    if (state.classList) {
      hook.unhook()
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
        hook.unhook()
      }
    }

    if (state.dependencies) {
      chokidarWatcher?.unwatch(state.dependencies)
    }
    state.dependencies = getModuleDependencies(state.configPath)
    chokidarWatcher?.add(state.dependencies)

    state.configId = getConfigId(state.configPath, state.dependencies)

    state.plugins = await getPlugins(originalConfig)
    if (postcssResult) {
      state.classNames = (await extractClassNames(postcssResult.root)) as ClassNames
    }
    state.variants = getVariants(state)

    let screens = dlv(state.config, 'theme.screens', dlv(state.config, 'screens', {}))
    state.screens = isObject(screens) ? Object.keys(screens) : []

    state.enabled = true

    updateAllDiagnostics(state)

    registerCapabilities(state.dependencies)
  }

  return {
    state,
    tryInit,
    dispose() {
      for (let { dispose } of disposables) {
        dispose()
      }
    },
    onUpdateSettings(settings: any): void {
      documentSettingsCache.clear()
      if (state.enabled) {
        updateAllDiagnostics(state)
      }
      if (settings.editor.colorDecorators) {
        registerCapabilities(state.dependencies)
      } else {
        connection.sendNotification('@/tailwindCSS/clearColors')
      }
    },
    onHover(params: TextDocumentPositionParams): Promise<Hover> {
      if (!state.enabled) return null
      let document = documentService.getDocument(params.textDocument.uri)
      if (!document) return null
      return doHover(state, document, params.position)
    },
    onCompletion(params: CompletionParams): Promise<CompletionList> {
      if (!state.enabled) return null
      let document = documentService.getDocument(params.textDocument.uri)
      if (!document) return null
      return doComplete(state, document, params.position, params.context)
    },
    onCompletionResolve(item: CompletionItem): Promise<CompletionItem> {
      if (!state.enabled) return null
      return resolveCompletionItem(state, item)
    },
    onCodeAction(params: CodeActionParams): Promise<CodeAction[]> {
      if (!state.enabled) return null
      return doCodeActions(state, params)
    },
    provideDiagnostics: debounce((document: TextDocument) => {
      if (!state.enabled) return
      provideDiagnostics(state, document)
    }, 500),
    async onDocumentColor(params: DocumentColorParams): Promise<ColorInformation[]> {
      if (!state.enabled) return []
      let document = documentService.getDocument(params.textDocument.uri)
      if (!document) return []
      return getDocumentColors(state, document)
    },
    async onColorPresentation(params: ColorPresentationParams): Promise<ColorPresentation[]> {
      let document = documentService.getDocument(params.textDocument.uri)
      let className = document.getText(params.range)
      let match = className.match(
        new RegExp(`-\\[(${colorNames.join('|')}|(?:(?:#|rgba?\\(|hsla?\\())[^\\]]+)\\]$`, 'i')
      )
      // let match = className.match(/-\[((?:#|rgba?\(|hsla?\()[^\]]+)\]$/i)
      if (match === null) return []

      let currentColor = match[1]

      let isNamedColor = colorNames.includes(currentColor)

      let color: culori.RgbColor = {
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
  }
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

function getVariants(state: State): Record<string, string> {
  if (state.jit) {
    function escape(className: string): string {
      let node = state.modules.postcssSelectorParser.module.className()
      node.value = className
      return dlv(node, 'raws.value', node.value)
    }

    let result = {}
    // [name, [sort, fn]]
    // [name, [[sort, fn]]]
    Array.from(state.jitContext.variantMap as Map<string, [any, any]>).forEach(
      ([variantName, variantFnOrFns]) => {
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
          let returnValue = fn({
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

        result[variantName] = definitions.join(', ') || null
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

  return variants.reduce((obj, variant) => ({ ...obj, [variant]: null }), {})
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
          pkg = __non_webpack_require__(pkg)
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

class TW {
  private initialized = false
  private workspaces: Map<string, { name: string; workspaceFsPath: string }>
  private projects: Map<string, ProjectService>
  private documentService: DocumentService
  public initializeParams: InitializeParams

  constructor(private connection: Connection) {
    this.documentService = new DocumentService(this.connection)
    this.workspaces = new Map()
    this.projects = new Map()
  }

  async init(): Promise<void> {
    if (this.initialized) return

    this.initialized = true

    // TODO
    const workspaceFolders =
      false &&
      Array.isArray(this.initializeParams.workspaceFolders) &&
      this.initializeParams.capabilities.workspace?.workspaceFolders
        ? this.initializeParams.workspaceFolders.map((el) => ({
            name: el.name,
            fsPath: getFileFsPath(el.uri),
          }))
        : this.initializeParams.rootPath
        ? [{ name: '', fsPath: normalizeFileNameToFsPath(this.initializeParams.rootPath) }]
        : []

    if (workspaceFolders.length === 0) {
      console.error('No workspace folders found, not initializing.')
      return
    }

    await Promise.all(
      workspaceFolders.map(async (folder) => {
        return this.addProject(folder.fsPath, this.initializeParams)
      })
    )

    this.setupLSPHandlers()

    this.connection.onDidChangeConfiguration(async ({ settings }) => {
      for (let [, project] of this.projects) {
        project.onUpdateSettings(settings)
      }
    })

    this.connection.onShutdown(() => {
      this.dispose()
    })

    this.documentService.onDidChangeContent((change) => {
      // TODO
      const project = Array.from(this.projects.values())[0]
      project?.provideDiagnostics(change.document)
    })
  }

  private async addProject(folder: string, params: InitializeParams): Promise<void> {
    if (this.projects.has(folder)) {
      await this.projects.get(folder).tryInit()
    } else {
      const project = await createProjectService(
        folder,
        this.connection,
        params,
        this.documentService
      )
      await project.tryInit()
      this.projects.set(folder, project)
    }
  }

  private setupLSPHandlers() {
    this.connection.onHover(this.onHover.bind(this))
    this.connection.onCompletion(this.onCompletion.bind(this))
    this.connection.onCompletionResolve(this.onCompletionResolve.bind(this))
    this.connection.onDocumentColor(this.onDocumentColor.bind(this))
    this.connection.onColorPresentation(this.onColorPresentation.bind(this))
    this.connection.onCodeAction(this.onCodeAction.bind(this))
  }

  async onDocumentColor(params: DocumentColorParams): Promise<ColorInformation[]> {
    const project = Array.from(this.projects.values())[0]
    return project?.onDocumentColor(params) ?? []
  }

  async onColorPresentation(params: ColorPresentationParams): Promise<ColorPresentation[]> {
    const project = Array.from(this.projects.values())[0]
    return project?.onColorPresentation(params) ?? []
  }

  async onHover(params: TextDocumentPositionParams): Promise<Hover> {
    // TODO
    const project = Array.from(this.projects.values())[0]
    return project?.onHover(params) ?? null
  }

  async onCompletion(params: CompletionParams): Promise<CompletionList> {
    // TODO
    const project = Array.from(this.projects.values())[0]
    return project?.onCompletion(params) ?? null
  }

  async onCompletionResolve(item: CompletionItem): Promise<CompletionItem> {
    // TODO
    const project = Array.from(this.projects.values())[0]
    return project?.onCompletionResolve(item) ?? null
  }

  onCodeAction(params: CodeActionParams): Promise<CodeAction[]> {
    // TODO
    const project = Array.from(this.projects.values())[0]
    return project?.onCodeAction(params) ?? null
  }

  listen() {
    this.connection.listen()
  }

  dispose(): void {
    for (let [, project] of this.projects) {
      project.dispose()
    }
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
}

function supportsDynamicRegistration(connection: Connection, params: InitializeParams): boolean {
  return (
    connection.onInitialized &&
    params.capabilities.textDocument.hover.dynamicRegistration &&
    params.capabilities.textDocument.colorProvider.dynamicRegistration &&
    params.capabilities.textDocument.codeAction.dynamicRegistration &&
    params.capabilities.textDocument.completion.dynamicRegistration
  )
}

const tw = new TW(connection)

connection.onInitialize(async (params: InitializeParams): Promise<InitializeResult> => {
  tw.initializeParams = params

  if (supportsDynamicRegistration(connection, params)) {
    return {
      capabilities: {
        textDocumentSync: TextDocumentSyncKind.Full,
      },
    }
  }

  tw.init()

  return {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Full,
      hoverProvider: true,
      colorProvider: true,
      codeActionProvider: true,
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
