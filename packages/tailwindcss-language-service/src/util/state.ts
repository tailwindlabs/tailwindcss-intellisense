import type { TextDocuments, Connection, Range } from 'vscode-languageserver'
import type { TextDocument } from 'vscode-languageserver-textdocument'

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
  documentSettings: Map<string, Settings>
  globalSettings: Settings
  userLanguages: Record<string, string>
  capabilities: {
    configuration: boolean
    diagnosticRelatedInformation: boolean
  }
}

type DiagnosticSeveritySetting = 'ignore' | 'warning' | 'error'

export type Settings = {
  emmetCompletions: boolean
  includeLanguages: Record<string, string>
  validate: boolean
  lint: {
    cssConflict: DiagnosticSeveritySetting
    invalidApply: DiagnosticSeveritySetting
    invalidScreen: DiagnosticSeveritySetting
    invalidVariant: DiagnosticSeveritySetting
    invalidConfigPath: DiagnosticSeveritySetting
    invalidTailwindDirective: DiagnosticSeveritySetting
  }
}

interface NotificationEmitter {
  on: (name: string, handler: (args: any) => void) => void
  off: (name: string, handler: (args: any) => void) => void
  emit: (name: string, args: any) => Promise<any>
}

export type State = null | {
  enabled: boolean
  emitter?: NotificationEmitter
  version?: string
  configPath?: string
  config?: any
  modules?: {
    tailwindcss: any
    postcss: any
  }
  separator?: string
  plugins?: any[]
  variants?: string[]
  classNames?: ClassNames
  dependencies?: string[]
  featureFlags?: { future: string[]; experimental: string[] }
  editor?: EditorState
  error?: Error
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
