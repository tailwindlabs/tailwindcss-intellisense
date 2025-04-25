import type {
  CompletionItem,
  CompletionList,
  CompletionParams,
  Connection,
  DocumentColorParams,
  ColorInformation,
  ColorPresentation,
  Hover,
  InitializeParams,
  TextDocumentPositionParams,
  ColorPresentationParams,
  CodeActionParams,
  CodeAction,
  Disposable,
  DocumentLinkParams,
  DocumentLink,
  CodeLensParams,
  CodeLens,
} from 'vscode-languageserver/node'
import { FileChangeType } from 'vscode-languageserver/node'
import type { TextDocument } from 'vscode-languageserver-textdocument'
import { URI } from 'vscode-uri'
import { showError, showWarning, SilentError } from './util/error'
import * as path from 'node:path'
import * as fs from 'node:fs'
import findUp from 'find-up'
import picomatch from 'picomatch'
import { resolveFrom, setPnpApi } from './util/resolveFrom'
import type { AtRule, Container, Node, Result } from 'postcss'
import Hook from './lib/hook'
import * as semver from '@tailwindcss/language-service/src/util/semver'
import dlv from 'dlv'
import { dset } from 'dset'
import pkgUp from 'pkg-up'
import stackTrace from 'stack-trace'
import extractClassNames from './lib/extractClassNames'
import { klona } from 'klona/full'
import { doHover } from '@tailwindcss/language-service/src/hoverProvider'
import { getCodeLens } from '@tailwindcss/language-service/src/codeLensProvider'
import { Resolver } from './resolver'
import {
  doComplete,
  resolveCompletionItem,
} from '@tailwindcss/language-service/src/completionProvider'
import type {
  State,
  FeatureFlags,
  Settings,
  ClassNames,
  Variant,
  ClassEntry,
} from '@tailwindcss/language-service/src/util/state'
import { provideDiagnostics } from './lsp/diagnosticsProvider'
import { doCodeActions } from '@tailwindcss/language-service/src/codeActions/codeActionProvider'
import { getDocumentColors } from '@tailwindcss/language-service/src/documentColorProvider'
import { getDocumentLinks } from '@tailwindcss/language-service/src/documentLinksProvider'
import { debounce } from 'debounce'
import { getModuleDependencies } from './util/getModuleDependencies'
import assert from 'node:assert'
// import postcssLoadConfig from 'postcss-load-config'
import { bigSign } from '@tailwindcss/language-service/src/util/jit'
import { getColor } from '@tailwindcss/language-service/src/util/color'
import * as culori from 'culori'
import namedColors from 'color-name'
import tailwindPlugins from './lib/plugins'
import isExcluded from './util/isExcluded'
import { getFileFsPath } from './util/uri'
import { PACKAGE_LOCK_GLOB } from './lib/constants'
import {
  first,
  firstOptional,
  withoutLogs,
  clearRequireCache,
  withFallback,
  isObject,
  pathToFileURL,
  changeAffectsFile,
  normalizePath,
  normalizeDriveLetter,
} from './utils'
import type { DocumentService } from './documents'
import type { ProjectConfig } from './project-locator'
import { supportedFeatures } from '@tailwindcss/language-service/src/features'
import { loadDesignSystem } from './util/v4'
import { readCssFile } from './util/css'
import type { DesignSystem } from '@tailwindcss/language-service/src/util/v4'

const colorNames = Object.keys(namedColors)

function getConfigId(configPath: string, configDependencies: string[]): string {
  return JSON.stringify(
    [configPath, ...configDependencies].map((file) => [file, fs.statSync(file).mtimeMs]),
  )
}

export interface ProjectService {
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
  onDocumentLinks(params: DocumentLinkParams): Promise<DocumentLink[]>
  onCodeLens(params: CodeLensParams): Promise<CodeLens[]>
  sortClassLists(classLists: string[]): string[]

  dependencies(): Iterable<string>
  reload(): Promise<void>
}

export enum DocumentSelectorPriority {
  USER_CONFIGURED = 0,
  CONFIG_FILE = 0,
  CSS_FILE = 0,
  CONTENT_FILE = 1,
  CSS_DIRECTORY = 2,
  CONFIG_DIRECTORY = 3,
  PACKAGE_DIRECTORY = 4,
  ROOT_DIRECTORY = 5,
}

export type DocumentSelector = { pattern: string; priority: DocumentSelectorPriority }

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

export async function createProjectService(
  projectKey: string,
  projectConfig: ProjectConfig,
  connection: Connection,
  params: InitializeParams,
  documentService: DocumentService,
  updateCapabilities: () => void,
  checkOpenDocuments: () => void,
  refreshDiagnostics: () => void,
  watchPatterns: (patterns: string[]) => void,
  initialTailwindVersion: string,
  getConfiguration: (uri?: string) => Promise<Settings>,
  userLanguages: Record<string, string>,
  parentResolver?: Resolver,
): Promise<ProjectService> {
  /* Project dependencies require a design system reload */
  let dependencies = new Set<string>()

  dependencies.add(projectConfig.configPath)

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
    features: [],
    completionItemData: {
      _projectKey: projectKey,
    },
    editor: {
      connection,
      folder,
      userLanguages,
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
          let baseDir = path.dirname(getFileFsPath(document.uri))
          directory = await resolver.substituteId(`${directory}/`, baseDir)
          directory = path.resolve(baseDir, directory)

          let dirents = await fs.promises.readdir(directory, { withFileTypes: true })

          let result: Array<[string, { isDirectory: boolean }] | null> = await Promise.all(
            dirents.map(async (dirent) => {
              let isDirectory = dirent.isDirectory()
              let shouldRemove = await isExcluded(
                state,
                document,
                path.join(directory, dirent.name, isDirectory ? '/' : ''),
              )

              if (shouldRemove) return null

              return [dirent.name, { isDirectory }]
            }),
          )

          return result.filter((item) => item !== null)
        } catch {
          return []
        }
      },
    },
  }

  if (projectConfig.configPath && projectConfig.config.source === 'js') {
    let deps = []
    try {
      deps = getModuleDependencies(projectConfig.configPath)
    } catch {}
    watchPatterns([
      ...getWatchPatternsForFile(projectConfig.configPath, projectConfig.folder),
      ...deps.flatMap((dep) => getWatchPatternsForFile(dep, projectConfig.folder)),
    ])
  }

  let resolver = await parentResolver.child({
    root: projectConfig.folder,
  })

  function log(...args: string[]): void {
    console.log(
      `[${path.relative(projectConfig.folder, projectConfig.configPath)}] ${args.join(' ')}`,
    )
  }

  function onFileEvents(changes: Array<{ file: string; type: FileChangeType }>): void {
    let needsInit = false
    let needsRebuild = false

    let isPackageMatcher = picomatch(`**/${PACKAGE_LOCK_GLOB}`, { dot: true })

    for (let change of changes) {
      let file = normalizeDriveLetter(normalizePath(change.file))

      let isConfigFile = changeAffectsFile(file, [projectConfig.configPath])
      let isDependency = changeAffectsFile(file, state.dependencies ?? [])
      let isPackageFile = isPackageMatcher(file)

      if (!isConfigFile && !isDependency && !isPackageFile) continue

      if (!enabled) {
        if (
          !projectConfig.isUserConfigured &&
          projectConfig.configPath &&
          (isConfigFile || isDependency)
        ) {
          documentSelector = [
            ...documentSelector.filter(
              ({ priority }) => priority !== DocumentSelectorPriority.CONTENT_FILE,
            ),
            ...getContentDocumentSelectorFromConfigFile(
              projectConfig.configPath,
              initialTailwindVersion,
              projectConfig.folder,
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
      { cwd: folder },
    )

    if (pnpPath) {
      let pnpApi = require(pnpPath)
      pnpApi.setup()
      setPnpApi(pnpApi)
    }

    const configDependencies =
      projectConfig.config.source === 'js' ? getModuleDependencies(configPath) : []
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
    let transformThemeValueFn: (section: any) => (value: any) => any
    let loadConfigFn: (path: string) => any
    let featureFlags: FeatureFlags = { future: [], experimental: [] }
    let applyComplexClasses: any

    try {
      let tailwindcssPkgPath = await resolver.resolveCjsId('tailwindcss/package.json', configDir)
      let tailwindDir = path.dirname(tailwindcssPkgPath)
      tailwindcssVersion = require(tailwindcssPkgPath).version

      // Loading via `await import(…)` with the Yarn PnP API is not possible
      if (await resolver.hasPnP()) {
        let tailwindcssPath = await resolver.resolveCjsId('tailwindcss', configDir)

        tailwindcss = require(tailwindcssPath)
      } else {
        let tailwindcssPath = await resolver.resolveJsId('tailwindcss', configDir)
        let tailwindcssURL = pathToFileURL(tailwindcssPath).href

        tailwindcss = await import(tailwindcssURL)
      }

      // TODO: The module should be loaded in the project locator
      // and this should be determined there and passed in instead
      let features = supportedFeatures(tailwindcssVersion, tailwindcss)
      log(`supported features: ${JSON.stringify(features)}`)
      state.features = features

      if (params.initializationOptions?.testMode) {
        state.features = [
          ...state.features,
          ...(params.initializationOptions.additionalFeatures ?? []),
        ]
      }

      if (!features.includes('css-at-theme')) {
        tailwindcss = tailwindcss.default ?? tailwindcss
      }

      log(`Loaded tailwindcss v${tailwindcssVersion}: ${tailwindDir}`)

      if (features.includes('css-at-theme')) {
        state.configPath = configPath
        state.version = tailwindcssVersion
        state.isCssConfig = true
        state.v4 = true
        state.jit = true
        state.modules = {
          tailwindcss: { version: tailwindcssVersion, module: tailwindcss },
          postcss: { version: null, module: null },
          resolveConfig: { module: null },
          loadConfig: { module: null },
        }

        return tryRebuild()
      }

      if (projectConfig.config.source === 'css') {
        log('CSS-based configuration is not supported before Tailwind CSS v4')
        state.enabled = false
        enabled = false

        // The fallback to a bundled v4 is in the catch block
        return
      }

      const postcssPath = await resolver.resolveCjsId('postcss', tailwindDir)
      const postcssPkgPath = await resolver.resolveCjsId('postcss/package.json', tailwindDir)
      const postcssDir = path.dirname(postcssPkgPath)
      const postcssSelectorParserPath = await resolver.resolveCjsId(
        'postcss-selector-parser',
        tailwindDir,
      )

      postcssVersion = require(postcssPkgPath).version

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

      try {
        resolveConfigFn = require(resolveFrom(tailwindDir, './resolveConfig.js'))
      } catch (_) {
        try {
          const resolveConfig = require(resolveFrom(tailwindDir, './lib/util/resolveConfig.js'))
          const defaultConfig = require(resolveFrom(tailwindDir, './stubs/defaultConfig.stub.js'))
          resolveConfigFn = (config) => resolveConfig([config, defaultConfig])
        } catch (_) {
          try {
            const resolveConfig = require(
              resolveFrom(tailwindDir, './lib/util/mergeConfigWithDefaults.js'),
            )
            const defaultConfig = require(resolveFrom(tailwindDir, './defaultConfig.js'))
            resolveConfigFn = (config) => resolveConfig.default(config, defaultConfig())
          } catch (_) {
            throw Error('Failed to load resolveConfig function.')
          }
        }
      }

      try {
        let fn = require(resolveFrom(tailwindDir, './lib/util/transformThemeValue.js'))
        transformThemeValueFn = fn.default ?? fn
      } catch {
        //
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
          require(resolveFrom(tailwindDir, './lib/lib/substituteClassApplyAtRules')),
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
            let createContextFn = require(
              resolveFrom(configDir, 'tailwindcss/lib/lib/setupContextUtils'),
            ).createContext
            assert.strictEqual(typeof createContextFn, 'function')
            return (state) => createContextFn(state.config)
          },
          () => {
            let createContextFn = require(
              resolveFrom(configDir, 'tailwindcss/lib/jit/lib/setupContextUtils'),
            ).createContext
            assert.strictEqual(typeof createContextFn, 'function')
            return (state) => createContextFn(state.config)
          },
          // TODO: the next two are canary releases only so can probably be removed
          () => {
            let setupTrackingContext = require(
              resolveFrom(configDir, 'tailwindcss/lib/jit/lib/setupTrackingContext'),
            ).default
            assert.strictEqual(typeof setupTrackingContext, 'function')
            return (state) =>
              setupTrackingContext(
                state.configPath,
                tailwindDirectives,
                registerDependency,
              )(result, root)
          },
          () => {
            let setupContext = require(
              resolveFrom(configDir, 'tailwindcss/lib/jit/lib/setupContext'),
            ).default
            assert.strictEqual(typeof setupContext, 'function')
            return (state) => setupContext(state.configPath, tailwindDirectives)(result, root)
          },
        )

        jitModules = {
          generateRules: {
            module: first(
              () =>
                require(resolveFrom(configDir, 'tailwindcss/lib/lib/generateRules')).generateRules,
              () =>
                require(resolveFrom(configDir, 'tailwindcss/lib/jit/lib/generateRules'))
                  .generateRules,
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
                  .default,
            ),
          },
          evaluateTailwindFunctions: {
            module: firstOptional(
              () =>
                require(resolveFrom(configDir, 'tailwindcss/lib/lib/evaluateTailwindFunctions'))
                  .default,
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
      if (projectConfig.config.source === 'css') {
        // @ts-ignore
        let tailwindcss = await import('tailwindcss-v4')
        let tailwindcssVersion = require('tailwindcss-v4/package.json').version
        let features = supportedFeatures(tailwindcssVersion, tailwindcss)

        log('Failed to load workspace modules.')
        log(`Using bundled version of \`tailwindcss\`: v${tailwindcssVersion}`)

        state.configPath = configPath
        state.version = tailwindcssVersion
        state.isCssConfig = true
        state.v4 = true
        state.v4Fallback = true
        state.jit = true
        state.features = features

        if (params.initializationOptions?.testMode) {
          state.features = [
            ...state.features,
            ...(params.initializationOptions.additionalFeatures ?? []),
          ]
        }

        state.modules = {
          tailwindcss: { version: tailwindcssVersion, module: tailwindcss },
          postcss: { version: null, module: null },
          resolveConfig: { module: null },
          loadConfig: { module: null },
        }

        return tryRebuild()
      }

      let util = await import('node:util')

      console.error(util.format(error))
      tailwindcss = require('tailwindcss')
      resolveConfigFn = require('tailwindcss/resolveConfig')
      transformThemeValueFn = require('tailwindcss/lib/util/transformThemeValue').default
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
      transformThemeValue: { module: transformThemeValueFn },
      jit: jitModules,
    }
    state.browserslist = browserslist
    state.featureFlags = featureFlags
    state.version = tailwindcssVersion
    state.pluginVersions = pluginVersions

    try {
      state.corePlugins = Object.keys(
        require(resolveFrom(path.dirname(state.configPath), 'tailwindcss/lib/plugins/index.js')),
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
                }),
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

    if (state.isCssConfig) {
      try {
        let css = await readCssFile(state.configPath)
        let designSystem = await loadDesignSystem(
          resolver,
          state.modules.tailwindcss.module,
          state.configPath,
          css,
          state.v4Fallback ?? false,
        )

        state.designSystem = designSystem
        state.blocklist = Array.from(designSystem.invalidCandidates ?? [])

        let deps = designSystem.dependencies()

        for (let dep of deps) {
          dependencies.add(dep)
        }

        watchPatterns(Array.from(deps))

        originalConfig = { theme: {} }
      } catch {
        // TODO: Fall back to built-in v4 stuff
        // TODO: Log errors? It might get noisy as people are editing their CSS though
        enabled = false
        state.enabled = false
        return
      }
    } else if (loadConfig.module) {
      hook = new Hook(fs.realpathSync(state.configPath))
      try {
        originalConfig = await loadConfig.module(state.configPath)
        originalConfig = originalConfig.default ?? originalConfig
        state.jit = true
      } catch (err) {
        // The user's config failed to load in v3 so we need to fallback
        originalConfig = await resolveConfig.module({})
        state.jit = true

        // And warn the user
        console.error(`Unable to load config file at: ${state.configPath}`)
        console.error(err)
        showWarning(connection, 'Tailwind CSS is unable to load your config file', err)
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
        if (projectConfig.config.source === 'js') {
          require(state.configPath)
        }
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
          ({ priority }) => priority !== DocumentSelectorPriority.CONTENT_FILE,
        ),
        ...getContentDocumentSelectorFromConfigFile(
          state.configPath,
          tailwindcss.version,
          projectConfig.folder,
          originalConfig,
        ),
      ]
    }
    //////////////////////

    try {
      state.config = state.isCssConfig ? originalConfig : resolveConfig.module(originalConfig)
      state.separator = dlv(state.config, sepLocation)
      if (typeof state.separator !== 'string') {
        state.separator = ':'
      }
      if (!state.v4) {
        state.blocklist = Array.isArray(state.config.blocklist) ? state.config.blocklist : []
      }
      delete state.config.blocklist

      if (state.v4) {
        let classList = state.designSystem.getClassList()

        state.classList = classList.map((className) => {
          return [
            className[0],
            {
              ...className[1],
              color: getColor(state, className[0]),
            },
          ]
        })
      } else if (state.jit) {
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
            },
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
        getWatchPatternsForFile(dep, projectConfig.folder),
      ),
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

    let isTestMode = params.initializationOptions?.testMode ?? false
    if (!isTestMode) return

    connection.sendNotification('@/tailwindCSS/projectReloaded')
  }

  for (let entry of projectConfig.config.entries) {
    dependencies.add(entry.path)

    for (let dep of entry.deps) {
      dependencies.add(dep.path)
    }
  }

  return {
    projectConfig,
    enabled() {
      return enabled
    },
    enable() {
      enabled = true
    },

    dependencies: () => dependencies,
    async reload() {
      if (!state.v4) return

      console.log('---- RELOADING DESIGN SYSTEM ----')
      console.log(`---- ${state.configPath} ----`)

      let css = await readCssFile(state.configPath)
      let designSystem: DesignSystem

      let start = process.hrtime.bigint()

      try {
        designSystem = await loadDesignSystem(
          resolver,
          state.modules.tailwindcss.module,
          state.configPath,
          css,
          state.v4Fallback ?? false,
        )
      } catch (err) {
        console.error(err)
        throw err
      }

      // TODO: This is weird and should be changed
      // We use Object.create so no global state is mutated until necessary
      let pseudoState = Object.create(state, {
        designSystem: {
          value: designSystem,
        },
      })

      let classList: ClassEntry[] = designSystem.getClassList().map((className) => {
        return [
          className[0],
          {
            ...className[1],
            color: getColor(pseudoState, className[0]),
          },
        ]
      })

      state.designSystem = designSystem
      state.classList = classList
      state.variants = getVariants(state)
      state.blocklist = Array.from(designSystem.invalidCandidates ?? [])

      let deps = designSystem.dependencies()

      for (let dep of deps) {
        dependencies.add(dep)
      }

      watchPatterns(Array.from(deps))

      // Update capabilities to force color swatches to update across editors
      // TODO: Need to verify how well this works across various editors
      // updateCapabilities()

      let elapsed = process.hrtime.bigint() - start

      console.log(`---- RELOADED IN ${(Number(elapsed) / 1e6).toFixed(2)}ms ----`)

      let isTestMode = params.initializationOptions?.testMode ?? false
      if (!isTestMode) return

      connection.sendNotification('@/tailwindCSS/projectReloaded')
    },

    state,
    documentSelector() {
      return documentSelector
    },
    tryInit,
    async dispose() {
      state = { enabled: false, features: [] }
      for (let disposable of disposables) {
        ;(await disposable).dispose()
      }
    },
    async onUpdateSettings(settings: any): Promise<void> {
      if (state.enabled) {
        refreshDiagnostics()
      }

      updateCapabilities()
      connection.sendNotification('@/tailwindCSS/clearColors')
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
    async onCodeLens(params: CodeLensParams): Promise<CodeLens[]> {
      return withFallback(async () => {
        if (!state.enabled) return null
        let document = documentService.getDocument(params.textDocument.uri)
        if (!document) return null
        let settings = await state.editor.getConfiguration(document.uri)
        if (!settings.tailwindCSS.codeLens) return null
        if (await isExcluded(state, document)) return null
        return getCodeLens(state, document)
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
    onDocumentLinks(params: DocumentLinkParams): Promise<DocumentLink[]> {
      if (!state.enabled) return null
      let document = documentService.getDocument(params.textDocument.uri)
      if (!document) return null

      let documentPath = URI.parse(document.uri).fsPath
      let baseDir = path.dirname(documentPath)

      async function resolveTarget(linkPath: string) {
        linkPath = (await resolver.substituteId(linkPath, baseDir)) ?? linkPath

        return URI.file(path.resolve(baseDir, linkPath)).toString()
      }

      return getDocumentLinks(state, document, resolveTarget)
    },
    provideDiagnostics: debounce(
      (document: TextDocument) => {
        if (!state.enabled) return
        provideDiagnostics(state, document)
      },
      params.initializationOptions?.testMode ? 0 : 500,
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
        new RegExp(`-\\[(${colorNames.join('|')}|(?:(?:#|rgba?\\(|hsla?\\())[^\\]]+)\\]$`, 'i'),
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

        let classNamesWithOrder: [string, bigint | null][]

        if (state.v4) {
          classNamesWithOrder = state.designSystem.getClassOrder(classes)
        } else if (state.jitContext.getClassOrder) {
          classNamesWithOrder = state.jitContext.getClassOrder(classes)
        } else {
          classNamesWithOrder = getClassOrderPolyfill(state, classes)
        }

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

type SimplePlugin = (api: any) => {}
type WrappedPlugin = { handler: (api: any) => {} }
type Plugin = SimplePlugin | WrappedPlugin

function runPlugin(
  plugin: Plugin,
  state: State,
  apiOverrides: Record<string, Function> = {},
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
  if (state.v4) {
    let variants = Array.from(state.designSystem.getVariants())

    let prefix = state.designSystem.theme.prefix ?? ''
    if (prefix.length > 0) {
      variants.unshift({
        name: prefix,
        values: [],
        isArbitrary: false,
        hasDash: true,
        selectors: () => ['&'],
      })
    }

    return variants
  }

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
              ([_sort, fn]) => fn,
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
                }),
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
      },
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
        // @ts-ignore
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
    }),
  )
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
      { cwd },
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
  actualConfig?: any,
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
        : path.resolve(contentBase, item),
    )
    .map((item) => ({
      pattern: normalizeDriveLetter(normalizePath(item)),
      priority: DocumentSelectorPriority.CONTENT_FILE,
    }))
}
