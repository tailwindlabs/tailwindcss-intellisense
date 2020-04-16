import { TextDocuments, Connection } from 'vscode-languageserver'

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
  documents: TextDocuments
  documentSettings: Map<string, Settings>
  globalSettings: Settings
  capabilities: {
    configuration: boolean
  }
}

export type Settings = {
  emmetCompletions: boolean
}

export type State = null | {
  config: any
  separator: string
  plugins: any[]
  variants: string[]
  classNames: ClassNames
  dependencies: string[]
  editor: EditorState
}
