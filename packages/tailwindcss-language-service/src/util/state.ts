import type { Connection, Range, SymbolInformation } from 'vscode-languageserver'
import type { TextDocument } from 'vscode-languageserver-textdocument'
import type { Postcss } from 'postcss'
import type { KeywordColor } from './color'
import type * as culori from 'culori'
import type { DesignSystem } from './v4'
import type { Feature } from '../features'

export type ClassNamesTree = {
  [key: string]: ClassNamesTree
}

export type ClassNamesContext = {
  [key: string]: string[]
}

export type ClassNames = {
  context: ClassNamesContext
  classNames: ClassNamesTree
}

export type EditorState = {
  connection: Connection
  folder: string
  userLanguages: Record<string, string>
  capabilities: {
    configuration: boolean
    diagnosticRelatedInformation: boolean
    itemDefaults: string[]
  }
  getConfiguration: (uri?: string) => Promise<Settings>
  getDocumentSymbols: (uri: string) => Promise<SymbolInformation[]>
  readDirectory: (
    document: TextDocument,
    directory: string,
  ) => Promise<Array<[string, { isDirectory: boolean }]>>
}

type DiagnosticSeveritySetting = 'ignore' | 'warning' | 'error'

export type EditorSettings = {
  tabSize: number
}

export type TailwindCssSettings = {
  inspectPort: number | null
  emmetCompletions: boolean
  includeLanguages: Record<string, string>
  classAttributes: string[]
  classFunctions: string[]
  suggestions: boolean
  hovers: boolean
  codeLens: boolean
  codeActions: boolean
  validate: boolean
  showPixelEquivalents: boolean
  rootFontSize: number
  colorDecorators: boolean
  lint: {
    cssConflict: DiagnosticSeveritySetting
    invalidApply: DiagnosticSeveritySetting
    invalidScreen: DiagnosticSeveritySetting
    invalidVariant: DiagnosticSeveritySetting
    invalidConfigPath: DiagnosticSeveritySetting
    invalidTailwindDirective: DiagnosticSeveritySetting
    invalidSourceDirective: DiagnosticSeveritySetting
    recommendedVariantOrder: DiagnosticSeveritySetting
    usedBlocklistedClass: DiagnosticSeveritySetting
  }
  experimental: {
    classRegex: string[] | [string, string][]
    configFile: string | Record<string, string | string[]> | null
  }
  files: {
    exclude: string[]
  }
}

export type Settings = {
  editor: EditorSettings
  tailwindCSS: TailwindCssSettings
}

export interface FeatureFlags {
  future: string[]
  experimental: string[]
}

export interface Variant {
  name: string
  values: string[]
  isArbitrary: boolean
  hasDash: boolean
  selectors: (params?: { value?: string; label?: string }) => string[]
}

export interface ClassMetadata {
  color: culori.Color | KeywordColor | null
  modifiers?: string[]
}

export type ClassEntry = [string, ClassMetadata]

export interface State {
  enabled: boolean
  isCssConfig?: boolean
  configPath?: string
  configId?: string
  config?: any
  version?: string
  separator?: string
  dependencies?: string[]
  plugins?: any
  screens?: string[]
  variants?: Variant[]
  corePlugins?: string[]
  blocklist?: unknown[]
  modules?: {
    tailwindcss?: { version: string; module: any }
    postcss?: { version: string; module: Postcss }
    postcssSelectorParser?: { module: any }
    resolveConfig?: { module: any }
    transformThemeValue?: { module: any }
    loadConfig?: { module: any }
    jit?: {
      generateRules: { module: any }
      createContext: { module: any }
      expandApplyAtRules: { module: any }
      evaluateTailwindFunctions?: { module: any }
    }
  }

  v4?: boolean
  v4Fallback?: boolean
  designSystem?: DesignSystem

  browserslist?: string[]
  featureFlags?: FeatureFlags
  classNames?: ClassNames
  editor?: EditorState
  jit?: boolean
  jitContext?: any
  classList?: ClassEntry[]
  classListContainsMetadata?: boolean
  pluginVersions?: string
  completionItemData?: Record<string, any>
  features: Feature[]
  // postcssPlugins?: { before: any[]; after: any[] }
}

export type DocumentClassList = {
  classList: string
  range: Range
  important?: boolean
}

export type DocumentClassName = {
  className: string
  range: Range
  relativeRange: Range
  classList: DocumentClassList
}

export type DocumentHelperFunction = {
  helper: 'theme' | 'config' | 'var'
  path: string
  ranges: {
    full: Range
    path: Range
  }
}

export type ClassNameMeta = {
  source: 'base' | 'components' | 'utilities'
  pseudo: string[]
  scope: string[]
  context: string[]
}

/**
 * @internal
 */
export function getDefaultTailwindSettings(): Settings {
  return {
    editor: { tabSize: 2 },
    tailwindCSS: {
      inspectPort: null,
      emmetCompletions: false,
      classAttributes: ['class', 'className', 'ngClass', 'class:list'],
      classFunctions: [],
      codeActions: true,
      codeLens: true,
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
        invalidSourceDirective: 'error',
        recommendedVariantOrder: 'warning',
        usedBlocklistedClass: 'warning',
      },
      showPixelEquivalents: true,
      includeLanguages: {},
      files: {
        exclude: [
          // These paths need to be universally ignorable. This means that we
          // should only consider hidden folders with a commonly understood
          // meaning unless there is a very good reason to do otherwise.
          //
          // This means that things like `build`, `target`, `cache`, etc… are
          // not appropriate to include even though _in many cases_ they might
          // be ignorable. The names are too general and ignoring them could
          // cause us to ignore actual project files.

          // Version Control
          '**/.git/**',
          '**/.hg/**',
          '**/.svn/**',

          // NPM
          '**/node_modules/**',

          // Yarn v2+ metadata & caches
          '**/.yarn/**',

          // Python Virtual Environments
          '**/.venv/**',
          '**/venv/**',

          // Build caches
          '**/.next/**',
          '**/.parcel-cache/**',
          '**/.svelte-kit/**',
          '**/.turbo/**',
          '**/__pycache__/**',
        ],
      },
      experimental: {
        classRegex: [],
        configFile: null,
      },
    },
  }
}

/**
 *  @internal
 */
export function createState(
  partial: Omit<Partial<State>, 'editor'> & {
    editor?: Partial<EditorState>
  },
): State {
  return {
    enabled: true,
    features: [],
    blocklist: [],
    ...partial,
    editor: {
      get connection(): Connection {
        throw new Error('Not implemented')
      },
      folder: '/',
      userLanguages: {},
      capabilities: {
        configuration: true,
        diagnosticRelatedInformation: true,
        itemDefaults: [],
      },
      getConfiguration: () => {
        throw new Error('Not implemented')
      },
      getDocumentSymbols: async () => [],
      readDirectory: async () => [],
      ...partial.editor,
    },
  }
}
