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
} from 'vscode-languageserver/node'
import { TextDocument } from 'vscode-languageserver-textdocument'
import { URI } from 'vscode-uri'
import { showError, SilentError } from './util/error'
import glob from 'fast-glob'
import normalizePath from 'normalize-path'
import * as path from 'path'
import * as os from 'os'
import * as fs from 'fs'
import chokidar from 'chokidar'
import findUp from 'find-up'
import minimatch from 'minimatch'
import resolveFrom, { setPnpApi } from './util/resolveFrom'
import { /*postcssFallback,*/ Result } from 'postcss'
// import tailwindcssFallback from 'tailwindcss'
// import resolveConfigFallback from 'tailwindcss/resolveConfig'
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
import { fromRatio, names as namedColors } from '@ctrl/tinycolor'
import { debounce } from 'debounce'
// import postcssLoadConfig from 'postcss-load-config'

const CONFIG_FILE_GLOB = 'tailwind.config.{js,cjs}'
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
] as const

const colorNames = Object.keys(namedColors)

declare var __non_webpack_require__: typeof require

const connection =
  process.argv.length <= 2 ? createConnection(process.stdin, process.stdout) : createConnection()

// console.log = connection.console.log.bind(connection.console)
// console.error = connection.console.error.bind(connection.console)

// process.on('unhandledRejection', (e: any) => {
//   connection.console.error(formatError(`Unhandled exception`, e))
// })

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

interface ProjectService {
  state: State
  tryInit: () => Promise<void>
  onUpdateSettings: (settings: any) => void
  onHover(params: TextDocumentPositionParams): Promise<Hover>
  onCompletion(params: CompletionParams): Promise<CompletionList>
  onCompletionResolve(item: CompletionItem): Promise<CompletionItem>
  provideDiagnostics(document: TextDocument): void
  onDocumentColor(params: DocumentColorParams): Promise<ColorInformation[]>
  onColorPresentation(params: ColorPresentationParams): Promise<ColorPresentation[]>
  onCodeAction(params: CodeActionParams): Promise<CodeAction[]>
}

async function createProjectService(
  folder: string,
  connection: Connection,
  params: InitializeParams,
  documentService: DocumentService
): Promise<ProjectService> {
  const state: State = {
    enabled: false,
    editor: {
      connection,
      globalSettings: params.initializationOptions.configuration as Settings,
      userLanguages: params.initializationOptions.userLanguages,
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

  const watcher = chokidar.watch(
    [normalizePath(`${folder}/**/${CONFIG_FILE_GLOB}`), normalizePath(`${folder}/**/package.json`)],
    {
      ignorePermissionErrors: true,
      ignoreInitial: true,
      ignored: ['**/node_modules/**'],
      awaitWriteFinish: {
        stabilityThreshold: 100,
        pollInterval: 20,
      },
    }
  )

  await new Promise<void>((resolve) => {
    watcher.on('ready', () => resolve())
  })

  watcher
    .on('add', () => {
      tryInit()
    })
    .on('unlink', (file) => {
      if (
        !state.enabled ||
        minimatch(file, '**/package.json') ||
        minimatch(file, `**/${CONFIG_FILE_GLOB}`)
      ) {
        tryInit()
      } else {
        tryRebuild()
      }
    })
    .on('change', (file) => {
      if (!state.enabled || minimatch(file, '**/package.json')) {
        tryInit()
      } else {
        tryRebuild()
      }
    })

  async function registerCapabilities(): Promise<void> {
    if (supportsDynamicRegistration(connection, params)) {
      if (registrations) {
        ;(await registrations).dispose()
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

      registrations = connection.client.register(capabilities)
    }
  }

  function resetState(): void {
    clearAllDiagnostics(state)
    Object.keys(state).forEach((key) => {
      if (key !== 'editor') {
        delete state[key]
      }
    })
    state.enabled = false
    registerCapabilities()
    // TODO reset watcher (remove config dependencies)
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
        concurrency: Math.max(os.cpus().length, 1),
      })
    )
      .map(normalizePath)
      .sort((a: string, b: string) => a.split('/').length - b.split('/').length)
      .map(path.normalize)

    if (!configPath) {
      throw new SilentError('No config file found.')
    }

    console.log(`Found Tailwind CSS config file: ${configPath}`)

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

    const configModified = fs.statSync(configPath).mtimeMs
    const configDir = path.dirname(configPath)
    let tailwindcss: any
    let postcss: any
    let postcssSelectorParser: any
    let jitModules: typeof state.modules.jit
    let tailwindcssVersion: string | undefined
    let postcssVersion: string | undefined
    let browserslist: string[] | undefined
    let resolveConfigFn: (config: any) => any
    let featureFlags: FeatureFlags = { future: [], experimental: [] }
    let applyComplexClasses: any

    try {
      const tailwindcssPath = resolveFrom(configDir, 'tailwindcss')
      const tailwindcssPkgPath = resolveFrom(configDir, 'tailwindcss/package.json')
      const tailwindcssPkg = __non_webpack_require__(tailwindcssPkgPath)
      const tailwindDir = path.dirname(tailwindcssPkgPath)

      const postcssPath = resolveFrom(tailwindDir, 'postcss')
      const postcssPkgPath = resolveFrom(tailwindDir, 'postcss/package.json')
      const postcssDir = path.dirname(postcssPkgPath)
      const postcssSelectorParserPath = resolveFrom(tailwindDir, 'postcss-selector-parser')

      postcss = __non_webpack_require__(postcssPath)
      postcssVersion = __non_webpack_require__(postcssPkgPath).version
      postcssSelectorParser = __non_webpack_require__(postcssSelectorParserPath)
      console.log(`Loaded postcss v${postcssVersion}: ${postcssDir}`)
      tailwindcss = __non_webpack_require__(tailwindcssPath)
      tailwindcssVersion = tailwindcssPkg.version
      console.log(`Loaded tailwindcss v${tailwindcssVersion}: ${tailwindDir}`)

      if (
        state.enabled &&
        postcssVersion === state.modules.postcss.version &&
        tailwindcssVersion === state.modules.tailwindcss.version &&
        configPath === state.configPath &&
        configModified === state.configModified
      ) {
        return
      }

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
        applyComplexClasses = __non_webpack_require__(
          resolveFrom(tailwindDir, './lib/lib/substituteClassApplyAtRules')
        )
      } else if (semver.gte(tailwindcssVersion, '1.7.0')) {
        applyComplexClasses = __non_webpack_require__(
          resolveFrom(tailwindDir, './lib/flagged/applyComplexClasses')
        )
      }

      try {
        featureFlags = __non_webpack_require__(resolveFrom(tailwindDir, './lib/featureFlags.js'))
      } catch (_) {}

      try {
        jitModules = {
          generateRules: {
            module: __non_webpack_require__(
              resolveFrom(
                configDir,
                semver.gte(tailwindcssVersion, '2.1.3')
                  ? 'tailwindcss/lib/jit/lib/generateRules'
                  : 'tailwindcss/jit/lib/generateRules'
              )
            ).generateRules,
          },
        }
      } catch (_) {}
    } catch (error) {
      throw new SilentError(error.message)
      // TODO: force mode
      // tailwindcss = tailwindcssFallback
      // resolveConfigFn = resolveConfigFallback
      // postcss = postcssFallback
      // applyComplexClasses = require('tailwindcss/lib/lib/substituteClassApplyAtRules')
      // tailwindcssVersion = '2.0.3'
      // postcssVersion = '8.2.6'
      // console.log(
      //   `Failed to load workspace modules. Initializing with tailwindcss v${tailwindcssVersion}`
      // )
    }

    state.configPath = configPath
    state.configModified = configModified
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

    if (applyComplexClasses && !applyComplexClasses.default.__patched) {
      let _applyComplexClasses = applyComplexClasses.default
      applyComplexClasses.default = (config, ...args) => {
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
    let userSeperator: string
    let userPurge
    let userVariants: any
    let userMode: any
    let hook = new Hook(fs.realpathSync(state.configPath), (exports) => {
      userSeperator = dlv(exports, sepLocation)
      if (typeof userSeperator !== 'string') {
        userSeperator = undefined
      }
      userPurge = exports.purge
      dset(
        exports,
        sepLocation,
        `__TWSEP__${typeof userSeperator === 'undefined' ? ':' : userSeperator}__TWSEP__`
      )
      exports.purge = []
      if (state.modules.jit && exports.mode === 'jit') {
        state.jit = true
        userVariants = exports.variants
        exports.variants = []
        userMode = exports.mode
        delete exports.mode
      } else {
        state.jit = false
      }

      // inject JIT `matchUtilities` function
      if (Array.isArray(exports.plugins)) {
        for (let index in exports.plugins) {
          let plugin = exports.plugins[index]
          if (typeof plugin === 'function') {
            exports.plugins[index] = (...args) => {
              if (!args[0].matchUtilities) {
                args[0].matchUtilities = () => {}
              }
              return plugin(...args)
            }
          } else if (plugin.handler) {
            let oldHandler = plugin.handler
            plugin.handler = (...args) => {
              if (!args[0].matchUtilities) {
                args[0].matchUtilities = () => {}
              }
              return oldHandler(...args)
            }
          }
        }
      }

      return exports
    })

    hook.watch()
    let config
    try {
      config = __non_webpack_require__(state.configPath)
    } catch (error) {
      hook.unwatch()
      hook.unhook()
      throw error
    }

    hook.unwatch()

    let postcssResult: Result
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

    if (typeof userSeperator !== 'undefined') {
      dset(config, sepLocation, userSeperator)
    } else {
      deletePropertyPath(config, sepLocation)
    }
    if (typeof userPurge !== 'undefined') {
      config.purge = userPurge
    } else {
      delete config.purge
    }
    if (typeof userVariants !== 'undefined') {
      config.variants = userVariants
    } else {
      delete config.variants
    }
    if (typeof userMode !== 'undefined') {
      config.mode = userMode
    }

    if (state.dependencies) {
      watcher.unwatch(state.dependencies)
    }
    state.dependencies = hook.deps
    watcher.add(state.dependencies)

    state.config = resolveConfig.module(config)
    state.separator = typeof userSeperator === 'string' ? userSeperator : ':'
    state.plugins = await getPlugins(config)
    state.classNames = (await extractClassNames(postcssResult.root)) as ClassNames

    if (state.jit) {
      let setupContext = semver.gte(tailwindcss.version, '2.1.3')
        ? __non_webpack_require__(
            resolveFrom(path.dirname(state.configPath), 'tailwindcss/lib/jit/lib/setupContext')
          ).default
        : __non_webpack_require__(
            resolveFrom(path.dirname(state.configPath), 'tailwindcss/jit/lib/setupContext')
          )

      state.jitContext = setupContext(state.configPath)(
        { opts: {}, messages: [] },
        state.modules.postcss.module.root()
      )
    }

    state.variants = getVariants(state)

    state.enabled = true

    updateAllDiagnostics(state)

    registerCapabilities()
  }

  return {
    state,
    tryInit,
    onUpdateSettings(settings: any): void {
      documentSettingsCache.clear()
      if (state.enabled) {
        updateAllDiagnostics(state)
      }
      if (settings.editor.colorDecorators) {
        registerCapabilities()
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
      return doComplete(state, document, params.position)
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
      let color = fromRatio({
        r: params.color.red,
        g: params.color.green,
        b: params.color.blue,
        a: params.color.alpha,
      })

      let hexValue = color.toHex8String(
        !isNamedColor && (currentColor.length === 4 || currentColor.length === 5)
      )
      if (hexValue.length === 5) {
        hexValue = hexValue.replace(/f$/, '')
      } else if (hexValue.length === 9) {
        hexValue = hexValue.replace(/ff$/, '')
      }

      let prefix = className.substr(0, match.index)

      return [
        hexValue,
        color.toRgbString().replace(/ /g, ''),
        color.toHslString().replace(/ /g, ''),
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

function getVariants(state: State): Record<string, string> {
  if (state.jit) {
    function escape(className: string): string {
      let node = state.modules.postcssSelectorParser.module.className()
      node.value = className
      return dlv(node, 'raws.value', node.value)
    }

    return Array.from(state.jitContext.variantMap as Map<string, [any, any]>).reduce(
      (acc, [variant, [, applyVariant]]) => {
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

        applyVariant({
          container: root,
          separator: state.separator,
          modifySelectors,
        })

        let definition = root
          .toString()
          .replace(`.${escape(`${variant}:${placeholder}`)}`, '&')
          .replace(/(?<!\\)[{}]/g, '')
          .replace(/\s*\n\s*/g, ' ')
          .trim()

        return {
          ...acc,
          [variant]: definition.includes(placeholder) ? null : definition,
        }
      },
      {}
    )
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
    //
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

connection.onInitialize(
  async (params: InitializeParams): Promise<InitializeResult> => {
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
  }
)

connection.onInitialized(async () => {
  await tw.init()
})

tw.listen()
