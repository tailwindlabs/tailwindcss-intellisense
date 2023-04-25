import type { TextDocuments, Connection, Range, SymbolInformation } from 'vscode-languageserver'
import type { TextDocument } from 'vscode-languageserver-textdocument'
import type { Postcss } from 'postcss'
import { KeywordColor } from './color'
import * as culori from 'culori'

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
    directory: string
  ) => Promise<Array<[string, { isDirectory: boolean }]>>
}

type DiagnosticSeveritySetting = 'ignore' | 'warning' | 'error'

export type EditorSettings = {
  tabSize: number
}

export type TailwindCssSettings = {
  emmetCompletions: boolean
  includeLanguages: Record<string, string>
  classAttributes: string[]
  suggestions: boolean
  hovers: boolean
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
    recommendedVariantOrder: DiagnosticSeveritySetting
  }
  experimental: {
    classRegex: string[]
    configFile: string | Record<string, string | string[]>
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

export interface State {
  enabled: boolean
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
    loadConfig?: { module: any }
    jit?: {
      generateRules: { module: any }
      createContext: { module: any }
      expandApplyAtRules: { module: any }
      evaluateTailwindFunctions?: { module: any }
    }
  }
  browserslist?: string[]
  featureFlags?: FeatureFlags
  classNames?: ClassNames
  editor?: EditorState
  jit?: boolean
  jitContext?: any
  classList?: Array<[string, { color: culori.Color | KeywordColor | null; modifiers?: string[] }]>
  classListContainsMetadata?: boolean
  pluginVersions?: string
  completionItemData?: Record<string, any>
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
  helper: 'theme' | 'config'
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
