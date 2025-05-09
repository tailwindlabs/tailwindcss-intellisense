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
  BulkUnregistration,
  Disposable,
  TextDocumentIdentifier,
  DocumentLinkParams,
  DocumentLink,
  InitializeResult,
  WorkspaceFolder,
  CodeLensParams,
  CodeLens,
  ServerCapabilities,
  ClientCapabilities,
} from 'vscode-languageserver/node'
import {
  CompletionRequest,
  DocumentColorRequest,
  BulkRegistration,
  CodeActionRequest,
  HoverRequest,
  DidChangeWatchedFilesNotification,
  FileChangeType,
  DocumentLinkRequest,
  TextDocumentSyncKind,
  CodeLensRequest,
  DidChangeConfigurationNotification,
} from 'vscode-languageserver/node'
import { URI } from 'vscode-uri'
import normalizePath from 'normalize-path'
import * as path from 'node:path'
import * as fs from 'node:fs/promises'
import * as fsSync from 'node:fs'
import type * as chokidar from 'chokidar'
import picomatch from 'picomatch'
import * as parcel from './watcher/index.js'
import { equal } from '@tailwindcss/language-service/src/util/array'
import { CONFIG_GLOB, CSS_GLOB, PACKAGE_LOCK_GLOB, TSCONFIG_GLOB } from './lib/constants'
import { clearRequireCache, isObject, changeAffectsFile, normalizeDriveLetter } from './utils'
import { DocumentService } from './documents'
import { createProjectService, type ProjectService } from './projects'
import { type SettingsCache, createSettingsCache } from './config'
import { readCssFile } from './util/css'
import { ProjectLocator, type ProjectConfig } from './project-locator'
import type { TailwindCssSettings } from '@tailwindcss/language-service/src/util/state'
import { createResolver, Resolver } from './resolver'
import { analyzeStylesheet } from './version-guesser.js'

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
  // End of an arbitrary value
  ']',
  // JIT "important" prefix
  '!',
  // JIT opacity modifiers
  '/',
  // Between parts of a variant or class
  '-',
] as const

async function getConfigFileFromCssFile(cssFile: string): Promise<string | null> {
  let css = await readCssFile(cssFile)
  if (!css) return null
  let match = css.match(/@config\s*(?<config>'[^']+'|"[^"]+")/)
  if (!match) {
    return null
  }
  return normalizeDriveLetter(
    normalizePath(path.resolve(path.dirname(cssFile), match.groups.config.slice(1, -1))),
  )
}

export class TW {
  private initPromise: Promise<void>
  private lspHandlersAdded = false
  private projects: Map<string, ProjectService>
  private projectCounter: number
  private documentService: DocumentService
  public initializeParams: InitializeParams
  private registrations: Promise<BulkUnregistration>
  private disposables: Disposable[] = []
  private watchPatterns: (patterns: string[]) => void = () => {}
  private watched: string[] = []

  private settingsCache: SettingsCache

  constructor(private connection: Connection) {
    this.documentService = new DocumentService(this.connection)
    this.projects = new Map()
    this.projectCounter = 0
    this.settingsCache = createSettingsCache(connection)
  }

  async init(): Promise<void> {
    if (!this.initPromise) {
      this.initPromise = this._init()
    }
    await this.initPromise
  }

  private getWorkspaceFolders(): WorkspaceFolder[] {
    if (this.initializeParams.workspaceFolders?.length) {
      return this.initializeParams.workspaceFolders.map((folder) => ({
        uri: URI.parse(folder.uri).fsPath,
        name: folder.name,
      }))
    }

    if (this.initializeParams.rootUri) {
      return [
        {
          uri: URI.parse(this.initializeParams.rootUri).fsPath,
          name: 'Root',
        },
      ]
    }

    if (this.initializeParams.rootPath) {
      return [
        {
          uri: URI.file(this.initializeParams.rootPath).fsPath,
          name: 'Root',
        },
      ]
    }

    return []
  }

  private async _init(): Promise<void> {
    clearRequireCache()

    let folders = this.getWorkspaceFolders().map((folder) => normalizePath(folder.uri))

    if (folders.length === 0) {
      console.error('No workspace folders found, not initializing.')
      return
    }

    // Initialize each workspace separately
    // We use `allSettled` here because failures in one folder should not prevent initialization of others
    //
    // NOTE: We should eventually be smart about avoiding duplicate work. We do
    // not necessarily need to set up file watchers, search for projects, read
    // configs, etc… per folder. Some of this work should be sharable.
    let results = await Promise.allSettled(
      folders.map((basePath) => this._initFolder(URI.file(basePath))),
    )

    for (let [idx, result] of results.entries()) {
      if (result.status === 'rejected') {
        console.error('Failed to initialize workspace folder', folders[idx], result.reason)
      }
    }

    await this.listenForEvents()
  }

  private async _initFolder(baseUri: URI): Promise<void> {
    // NOTE: We do this check because on Linux when using an LSP client that does
    // not support watching files on behalf of the server, we'll use Parcel
    // Watcher (if possible). If we start the watcher with a non-existent or
    // inaccessible directory, it will throw an error with a very unhelpful
    // message: "Bad file descriptor"
    //
    // The best thing we can do is an initial check for access to the directory
    // and log a more helpful error message if it fails.
    let base = baseUri.fsPath

    try {
      // TODO: Change this to fs.constants after the node version bump
      await fs.access(base, fsSync.constants.F_OK | fsSync.constants.R_OK)
    } catch (err) {
      console.error(
        `Unable to access the workspace folder [${base}]. This may happen if the directory does not exist or the current user does not have the necessary permissions to access it.`,
      )
      console.error(err)
      return
    }

    let initUserLanguages = this.initializeParams.initializationOptions?.userLanguages ?? {}

    if (Object.keys(initUserLanguages).length > 0) {
      console.warn(
        'Language mappings are currently set via initialization options (`userLanguages`). This is deprecated and will be removed in a future release. Please use the `tailwindCSS.includeLanguages` setting instead.',
      )
    }

    let workspaceFolders: Array<ProjectConfig> = []
    let globalSettings = await this.settingsCache.get()
    let ignore = globalSettings.tailwindCSS.files.exclude

    // Get user languages for the given workspace folder
    let folderSettings = await this.settingsCache.get(baseUri.toString())

    // Merge the languages from the global settings with the languages from the workspace folder
    let userLanguages = {
      ...initUserLanguages,
      ...(folderSettings.tailwindCSS.includeLanguages ?? {}),
    }

    let cssFileConfigMap: Map<string, string> = new Map()
    let configTailwindVersionMap: Map<string, string> = new Map()

    // base directory to resolve relative `experimental.configFile` paths against
    let userDefinedConfigBase = this.initializeParams.initializationOptions?.workspaceFile
      ? path.dirname(this.initializeParams.initializationOptions.workspaceFile)
      : base

    function getExplicitConfigFiles(settings: TailwindCssSettings) {
      function resolvePathForConfig(filepath: string) {
        return normalizeDriveLetter(normalizePath(path.resolve(userDefinedConfigBase, filepath)))
      }

      let configFileOrFiles = settings.experimental.configFile
      let configs: Record<string, string[]> = {}

      if (typeof configFileOrFiles === 'string') {
        let configFile = resolvePathForConfig(configFileOrFiles)
        let docSelectors = [resolvePathForConfig(path.resolve(base, '**'))]

        configs[configFile] = docSelectors
      } else if (isObject(configFileOrFiles)) {
        for (let [configFile, selectors] of Object.entries(configFileOrFiles)) {
          if (typeof configFile !== 'string') return null
          configFile = resolvePathForConfig(configFile)

          let docSelectors: string[]

          if (typeof selectors === 'string') {
            docSelectors = [resolvePathForConfig(selectors)]
          } else if (Array.isArray(selectors)) {
            docSelectors = selectors.map(resolvePathForConfig)
          } else {
            return null
          }

          configs[configFile] = docSelectors
        }
      } else if (configFileOrFiles) {
        return null
      }

      return Object.entries(configs)
    }

    let configs = getExplicitConfigFiles(globalSettings.tailwindCSS)

    if (configs === null) {
      console.error('Invalid `experimental.configFile` configuration, not initializing.')
      return
    }

    let resolver = await createResolver({
      root: base,
      pnp: true,
      tsconfig: true,
    })

    let locator = new ProjectLocator(base, globalSettings, resolver)

    if (configs.length > 0) {
      console.log('Loading Tailwind CSS projects from the workspace settings.')

      workspaceFolders = await locator.loadAllFromWorkspace(configs)
    } else {
      console.log("Searching for Tailwind CSS projects in the workspace's folders.")

      workspaceFolders = await locator.search()
    }

    for (let project of workspaceFolders) {
      // Track the Tailwind version for a given config
      configTailwindVersionMap.set(project.config.path, project.tailwind.version)

      if (project.config.source !== 'css') continue

      // Track the config file for a given CSS file
      for (let file of project.config.entries) {
        if (file.type !== 'css') continue
        cssFileConfigMap.set(file.path, project.config.path)
      }
    }

    let workspaceDescription = workspaceFolders.map((workspace) => {
      return {
        folder: workspace.folder,
        config: workspace.config.path,
        selectors: workspace.documentSelector,
        user: workspace.isUserConfigured,
        tailwind: workspace.tailwind,
      }
    })

    console.log(`[Global] Creating projects: ${JSON.stringify(workspaceDescription)}`)

    const onDidChangeWatchedFiles = async (
      changes: Array<{ file: string; type: FileChangeType }>,
    ): Promise<void> => {
      let needsRestart = false
      let needsSoftRestart = false

      let isPackageMatcher = picomatch(`**/${PACKAGE_LOCK_GLOB}`, { dot: true })
      let isCssMatcher = picomatch(`**/${CSS_GLOB}`, { dot: true })
      let isConfigMatcher = picomatch(`**/${CONFIG_GLOB}`, { dot: true })
      let isTSConfigMatcher = picomatch(`**/${TSCONFIG_GLOB}`, { dot: true })

      changeLoop: for (let change of changes) {
        let normalizedFilename = normalizePath(change.file)

        // This filename comes from VSCode rather than from the filesystem
        // which means the drive letter *might* be lowercased and we need
        // to normalize it so that we can compare it properly.
        normalizedFilename = normalizeDriveLetter(normalizedFilename)

        for (let ignorePattern of ignore) {
          let isIgnored = picomatch(ignorePattern, { dot: true })

          if (isIgnored(normalizedFilename)) {
            continue changeLoop
          }
        }

        let isPackageFile = isPackageMatcher(normalizedFilename)
        if (isPackageFile) {
          for (let [, project] of this.projects) {
            let twVersion = require('tailwindcss/package.json').version
            try {
              let v = require(
                await resolver.resolveCjsId(
                  'tailwindcss/package.json',
                  path.dirname(project.projectConfig.configPath),
                ),
              ).version
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

        let isTsconfig = isTSConfigMatcher(normalizedFilename)
        if (isTsconfig) {
          // TODO: Use a refresh() instead of a full server restart
          // let refreshPromise = retry({
          //   tries: 4,
          //   delay: 250,
          //   callback: () => resolver.refresh(),
          // })

          // try {
          //   await refreshPromise
          // } catch (err) {
          //   console.error('Unable to reload resolver', err)
          // }

          needsRestart = true
          break changeLoop
        }

        for (let [, project] of this.projects) {
          if (!project.state.v4) continue

          if (
            change.type === FileChangeType.Deleted &&
            changeAffectsFile(normalizedFilename, [project.projectConfig.configPath])
          ) {
            continue
          }

          if (!changeAffectsFile(normalizedFilename, project.dependencies())) continue

          needsSoftRestart = true
          break changeLoop
        }

        let isCssFile = isCssMatcher(`**/${CSS_GLOB}`)
        if (isCssFile && change.type !== FileChangeType.Deleted) {
          // TODO: Determine if we can only use `normalizedFilename`
          let configPath =
            (await getConfigFileFromCssFile(normalizedFilename)) ||
            (await getConfigFileFromCssFile(change.file))

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

          //
          else {
            // If the main CSS file in a project is deleted and then re-created
            // the server won't restart because the project is gone by now and
            // there's no concept of a "config file" for us to compare with
            //
            // So we'll check if the stylesheet could *potentially* create
            // a new project but we'll only do so if no projects were found
            //
            // If we did this all the time we'd potentially restart the server
            // unncessarily a lot while the user is editing their stylesheets
            if (this.projects.size > 0) continue

            let content = await readCssFile(change.file)
            if (!content) continue

            let stylesheet = analyzeStylesheet(content)
            if (!stylesheet.root) continue

            if (!stylesheet.versions.includes('4')) continue

            needsRestart = true
            break
          }
        }

        let isConfigFile = isConfigMatcher(normalizedFilename)
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

      if (needsSoftRestart) {
        try {
          await this.softRestart()
        } catch {
          this.restart()
        }
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
                changeIndex,
            )

          await onDidChangeWatchedFiles(normalizedChanges)
        }),
      )

      let disposable = await this.connection.client.register(
        DidChangeWatchedFilesNotification.type,
        {
          watchers: [
            { globPattern: `**/${CONFIG_GLOB}` },
            { globPattern: `**/${PACKAGE_LOCK_GLOB}` },
            { globPattern: `**/${CSS_GLOB}` },
            { globPattern: `**/${TSCONFIG_GLOB}` },
          ],
        },
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
      console.log(
        '[Global] Your LSP client does not support watching files on behalf of the server',
      )
      console.log('[Global] Using bundled file watcher: @parcel/watcher')
      let typeMap = {
        create: FileChangeType.Created,
        update: FileChangeType.Changed,
        delete: FileChangeType.Deleted,
      }

      let subscription = await parcel.subscribe(
        base,
        (err, events) => {
          onDidChangeWatchedFiles(
            events.map((event) => ({ file: event.path, type: typeMap[event.type] })),
          )
        },
        {
          ignore: ignore.map((ignorePattern) =>
            path.resolve(base, ignorePattern.replace(/^[*/]+/, '').replace(/[*/]+$/, '')),
          ),
        },
      )

      this.disposables.push({
        dispose() {
          subscription.unsubscribe()
        },
      })
    } else {
      console.log(
        '[Global] Your LSP client does not support watching files on behalf of the server',
      )
      console.log('[Global] Using bundled file watcher: chokidar')
      let watch: typeof chokidar.watch = require('chokidar').watch
      let chokidarWatcher = watch(
        [`**/${CONFIG_GLOB}`, `**/${PACKAGE_LOCK_GLOB}`, `**/${CSS_GLOB}`, `**/${TSCONFIG_GLOB}`],
        {
          cwd: base,
          ignorePermissionErrors: true,
          ignoreInitial: true,
          ignored: ignore,
          awaitWriteFinish: {
            stabilityThreshold: 100,
            pollInterval: 20,
          },
        },
      )

      await new Promise<void>((resolve) => {
        chokidarWatcher.on('ready', () => resolve())
      })

      chokidarWatcher
        .on('add', (file) =>
          onDidChangeWatchedFiles([
            { file: path.resolve(base, file), type: FileChangeType.Created },
          ]),
        )
        .on('change', (file) =>
          onDidChangeWatchedFiles([
            { file: path.resolve(base, file), type: FileChangeType.Changed },
          ]),
        )
        .on('unlink', (file) =>
          onDidChangeWatchedFiles([
            { file: path.resolve(base, file), type: FileChangeType.Deleted },
          ]),
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

    console.log(`[Global] Preparing projects...`)

    await Promise.all(
      workspaceFolders.map((projectConfig) =>
        this.addProject(
          projectConfig,
          this.initializeParams,
          this.watchPatterns,
          configTailwindVersionMap.get(projectConfig.configPath),
          userLanguages,
          resolver,
          baseUri,
        ),
      ),
    )

    console.log(`[Global] Initializing projects...`)

    await this.updateCommonCapabilities()

    // init projects for documents that are _already_ open
    let readyDocuments: string[] = []
    let enabledProjectCount = 0
    for (let document of this.documentService.getAllDocuments()) {
      let project = this.getProject(document)
      if (project && !project.enabled()) {
        project.enable()
        await project.tryInit()
        enabledProjectCount++
      }

      readyDocuments.push(document.uri)
    }

    console.log(`[Global] Initialized ${enabledProjectCount} projects`)

    this.disposables.push(
      this.connection.onDidChangeConfiguration(async ({ settings }) => {
        let previousExclude = globalSettings.tailwindCSS.files.exclude

        this.settingsCache.clear()

        globalSettings = await this.settingsCache.get()

        if (!equal(previousExclude, globalSettings.tailwindCSS.files.exclude)) {
          this.restart()
          return
        }

        for (let [, project] of this.projects) {
          project.onUpdateSettings(settings)
        }
      }),
    )

    const isTestMode = this.initializeParams.initializationOptions?.testMode ?? false

    if (!isTestMode) return

    console.log(`[Global][Test] Sending document notifications...`)

    await Promise.all(
      readyDocuments.map((uri) =>
        this.connection.sendNotification('@/tailwindCSS/documentReady', {
          uri,
        }),
      ),
    )
  }

  private async listenForEvents() {
    const isTestMode = this.initializeParams.initializationOptions?.testMode ?? false

    this.disposables.push(
      this.connection.onShutdown(() => {
        this.dispose()
      }),
    )

    this.disposables.push(
      this.documentService.onDidChangeContent((change) => {
        this.getProject(change.document)?.provideDiagnostics(change.document)
      }),
    )

    this.disposables.push(
      this.documentService.onDidOpen(async (event) => {
        let project = this.getProject(event.document)
        if (!project) return

        if (!project.enabled()) {
          project.enable()
          await project.tryInit()
        }

        if (!isTestMode) return

        // TODO: This is a hack and shouldn't be necessary
        // await new Promise((resolve) => setTimeout(resolve, 100))
        await this.connection.sendNotification('@/tailwindCSS/documentReady', {
          uri: event.document.uri,
        })
      }),
    )

    if (this.initializeParams.capabilities.workspace.workspaceFolders) {
      this.disposables.push(
        this.connection.workspace.onDidChangeWorkspaceFolders(async (evt) => {
          // Initialize any new folders that have appeared
          let added = evt.added
            .map((folder) => ({
              uri: URI.parse(folder.uri).fsPath,
              name: folder.name,
            }))
            .map((folder) => normalizePath(folder.uri))

          await Promise.allSettled(added.map((basePath) => this._initFolder(URI.file(basePath))))

          // TODO: If folders get removed we should cleanup any associated state and resources
        }),
      )
    }

    // TODO: This is a hack and shouldn't be necessary
    if (isTestMode) {
      await this.connection.sendNotification('@/tailwindCSS/serverReady')
    }
  }

  private filterNewWatchPatterns(patterns: string[]) {
    // Make sure the list of patterns is unique
    patterns = Array.from(new Set(patterns))

    // Filter out any patterns that are already being watched
    patterns = patterns.filter((pattern) => !this.watched.includes(pattern))

    this.watched.push(...patterns)

    return patterns
  }

  private async addProject(
    projectConfig: ProjectConfig,
    params: InitializeParams,
    watchPatterns: (patterns: string[]) => void,
    tailwindVersion: string,
    userLanguages: Record<string, string>,
    resolver: Resolver,
    baseUri: URI,
  ): Promise<void> {
    let key = String(this.projectCounter++)
    const project = await createProjectService(
      key,
      projectConfig,
      this.connection,
      params,
      this.documentService,
      () => this.updateProjectCapabilities(),
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
      tailwindVersion,
      this.settingsCache.get,
      userLanguages,
      resolver,
    )
    this.projects.set(key, project)

    if (!this.supportsTailwindProjectDetails) {
      return
    }

    this.connection.sendNotification('@/tailwindCSS/projectDetails', {
      uri: baseUri.toString(),
      config: projectConfig.configPath,
      tailwind: projectConfig.tailwind,
    })
  }

  private get supportsTailwindProjectDetails() {
    return this.initializeParams.capabilities.experimental?.['tailwind']?.projectDetails ?? false
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
    if (this.lspHandlersAdded) return
    this.lspHandlersAdded = true

    this.connection.onHover(this.onHover.bind(this))
    this.connection.onCompletion(this.onCompletion.bind(this))
    this.connection.onCompletionResolve(this.onCompletionResolve.bind(this))
    this.connection.onDocumentColor(this.onDocumentColor.bind(this))
    this.connection.onColorPresentation(this.onColorPresentation.bind(this))
    this.connection.onCodeAction(this.onCodeAction.bind(this))
    this.connection.onCodeLens(this.onCodeLens.bind(this))
    this.connection.onDocumentLinks(this.onDocumentLinks.bind(this))
    this.connection.onRequest(this.onRequest.bind(this))
  }

  private onRequest(
    method: '@/tailwindCSS/sortSelection',
    params: { uri: string; classLists: string[] },
  ): { error: string } | { classLists: string[] }
  private onRequest(
    method: '@/tailwindCSS/getProject',
    params: { uri: string },
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

  // Common capabilities are always supported by the language server and do not
  // require any project-specific information to know how to configure them.
  //
  // These capabilities will stay valid until/unless the server has to restart
  // in which case they'll be unregistered and then re-registered once project
  // discovery has completed
  private commonRegistrations: BulkUnregistration | undefined
  private async updateCommonCapabilities() {
    let capabilities = BulkRegistration.create()

    let client = this.initializeParams.capabilities

    if (client.textDocument?.hover?.dynamicRegistration) {
      capabilities.add(HoverRequest.type, { documentSelector: null })
    }

    if (client.textDocument?.colorProvider?.dynamicRegistration) {
      capabilities.add(DocumentColorRequest.type, { documentSelector: null })
    }

    if (client.textDocument?.codeAction?.dynamicRegistration) {
      capabilities.add(CodeActionRequest.type, { documentSelector: null })
    }

    if (client.textDocument?.codeLens?.dynamicRegistration) {
      capabilities.add(CodeLensRequest.type, { documentSelector: null })
    }

    if (client.textDocument?.documentLink?.dynamicRegistration) {
      capabilities.add(DocumentLinkRequest.type, { documentSelector: null })
    }

    if (client.workspace?.didChangeConfiguration?.dynamicRegistration) {
      capabilities.add(DidChangeConfigurationNotification.type, undefined)
    }

    this.commonRegistrations = await this.connection.client.register(capabilities)
  }

  // These capabilities depend on the projects we've found to appropriately
  // configure them. This may mean collecting information from all discovered
  // projects to determine what we can do and how
  private updateProjectCapabilities() {
    this.updateTriggerCharacters()
  }

  private lastTriggerCharacters: Set<string> | undefined
  private completionRegistration: Disposable | undefined
  private async updateTriggerCharacters() {
    // If the client does not suppory dynamic registration of completions then
    // we cannot update the set of trigger characters
    let client = this.initializeParams.capabilities
    if (!client.textDocument?.completion?.dynamicRegistration) return

    // The new set of trigger characters is all the static ones plus
    // any characters from any separator in v3 config
    let chars = new Set<string>(TRIGGER_CHARACTERS)

    for (let project of this.projects.values()) {
      let sep = project.state.separator
      if (typeof sep !== 'string') continue

      sep = sep.slice(-1)
      if (!sep) continue

      chars.add(sep)
    }

    // If the trigger characters haven't changed then we don't need to do anything
    if (equal(Array.from(chars), Array.from(this.lastTriggerCharacters ?? []))) return
    this.lastTriggerCharacters = chars

    this.completionRegistration?.dispose()
    this.completionRegistration = await this.connection.client.register(CompletionRequest.type, {
      documentSelector: null,
      resolveProvider: true,
      triggerCharacters: Array.from(chars),
    })
  }

  private getProject(document: TextDocumentIdentifier): ProjectService {
    let fallbackProject: ProjectService
    let matchedProject: ProjectService
    let matchedPriority: number = Infinity

    let uri = URI.parse(document.uri)
    let fsPath = uri.fsPath
    let normalPath = uri.path

    // This filename comes from VSCode rather than from the filesystem
    // which means the drive letter *might* be lowercased and we need
    // to normalize it so that we can compare it properly.
    fsPath = normalizeDriveLetter(fsPath)

    for (let project of this.projects.values()) {
      if (!project.projectConfig.configPath) {
        fallbackProject = fallbackProject ?? project
        continue
      }

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
        let pattern = selector.pattern.replace(/[\[\]{}()]/g, (m) => `\\${m}`)

        if (pattern.startsWith('!')) {
          if (picomatch(pattern.slice(1), { dot: true })(fsPath)) {
            break
          }

          if (picomatch(pattern.slice(1), { dot: true })(normalPath)) {
            break
          }
        }

        if (picomatch(pattern, { dot: true })(fsPath) && selector.priority < matchedPriority) {
          matchedProject = project
          matchedPriority = selector.priority

          continue
        }

        if (picomatch(pattern, { dot: true })(normalPath) && selector.priority < matchedPriority) {
          matchedProject = project
          matchedPriority = selector.priority

          continue
        }
      }
    }

    let project = matchedProject ?? fallbackProject

    if (!project) {
      console.debug('[GLOBAL] No matching project for document', {
        fsPath,
        normalPath,
      })
    }

    return project
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

  async onCodeLens(params: CodeLensParams): Promise<CodeLens[]> {
    await this.init()
    return this.getProject(params.textDocument)?.onCodeLens(params) ?? null
  }

  async onDocumentLinks(params: DocumentLinkParams): Promise<DocumentLink[]> {
    await this.init()
    return this.getProject(params.textDocument)?.onDocumentLinks(params) ?? null
  }

  setup() {
    this.connection.onInitialize(async (params: InitializeParams): Promise<InitializeResult> => {
      this.initializeParams = params

      this.setupLSPHandlers()

      return {
        capabilities: this.computeServerCapabilities(params.capabilities),
      }
    })

    this.connection.onInitialized(() => this.init())
  }

  computeServerCapabilities(client: ClientCapabilities) {
    let capabilities: ServerCapabilities = {
      textDocumentSync: TextDocumentSyncKind.Full,
      workspace: {
        workspaceFolders: {
          changeNotifications: true,
        },
      },
    }

    if (!client.textDocument?.hover?.dynamicRegistration) {
      capabilities.hoverProvider = true
    }

    if (!client.textDocument?.colorProvider?.dynamicRegistration) {
      capabilities.colorProvider = true
    }

    if (!client.textDocument?.codeAction?.dynamicRegistration) {
      capabilities.codeActionProvider = true
    }

    if (!client.textDocument?.codeLens?.dynamicRegistration) {
      capabilities.codeLensProvider = {
        resolveProvider: false,
      }
    }

    if (!client.textDocument?.completion?.dynamicRegistration) {
      capabilities.completionProvider = {
        resolveProvider: true,
        triggerCharacters: [...TRIGGER_CHARACTERS, ':'],
      }
    }

    if (!client.textDocument?.documentLink?.dynamicRegistration) {
      capabilities.documentLinkProvider = {}
    }

    return capabilities
  }

  listen() {
    this.connection.listen()
  }

  dispose(): void {
    this.connection.sendNotification('@/tailwindCSS/projectsDestroyed')
    for (let [, project] of this.projects) {
      project.dispose()
    }
    this.projects = new Map()

    this.refreshDiagnostics()

    this.commonRegistrations?.dispose()
    this.commonRegistrations = undefined

    this.completionRegistration?.dispose()
    this.completionRegistration = undefined

    this.disposables.forEach((d) => d.dispose())
    this.disposables.length = 0

    this.watched.length = 0
  }

  async restart(): Promise<void> {
    let isTestMode = this.initializeParams.initializationOptions?.testMode ?? false

    console.log('----------\nRESTARTING\n----------')
    this.dispose()
    this.initPromise = undefined
    await this.init()

    if (isTestMode) {
      this.connection.sendNotification('@/tailwindCSS/serverRestarted')
    }
  }

  async softRestart(): Promise<void> {
    // Tell each v4 project to reload it's design system
    for (let [, project] of this.projects) {
      if (!project.state.v4) continue

      // "soft"-reload the project
      try {
        await project.reload()
      } catch {}
    }
  }
}
