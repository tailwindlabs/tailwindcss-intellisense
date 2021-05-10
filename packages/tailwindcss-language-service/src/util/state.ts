import type { TextDocuments, Connection, Range, SymbolInformation } from 'vscode-languageserver'
import type { TextDocument } from 'vscode-languageserver-textdocument'
import type { Postcss } from 'postcss'

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
  documents: TextDocuments<TextDocument>
  globalSettings: Settings
  userLanguages: Record<string, string>
  capabilities: {
    configuration: boolean
    diagnosticRelatedInformation: boolean
  }
  getConfiguration: (uri?: string) => Promise<Settings>
  getDocumentSymbols: (uri: string) => Promise<SymbolInformation[]>
}

type DiagnosticSeveritySetting = 'ignore' | 'warning' | 'error'

export type Settings = {
  editor: {
    tabSize: number
  }
  tailwindCSS: {
    emmetCompletions: boolean
    includeLanguages: Record<string, string>
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
    }
  }
}

export interface FeatureFlags {
  future: string[]
  experimental: string[]
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
  variants?: Record<string, string | null>
  modules?: {
    tailwindcss?: { version: string; module: any }
    postcss?: { version: string; module: Postcss }
    postcssSelectorParser?: { module: any }
    resolveConfig?: { module: any }
    jit?: {
      generateRules: { module: any }
      setupContext: { module: any }
      expandApplyAtRules: { module: any }
    }
  }
  browserslist?: string[]
  featureFlags?: FeatureFlags
  classNames?: ClassNames
  editor?: EditorState
  jit?: boolean
  jitContext?: any
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
  full: string
  helper: 'theme' | 'config'
  value: string
  quotes: '"' | "'"
  range: Range
  valueRange: Range
}

export type ClassNameMeta = {
  source: 'base' | 'components' | 'utilities'
  pseudo: string[]
  scope: string[]
  context: string[]
}
