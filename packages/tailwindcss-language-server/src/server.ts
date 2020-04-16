/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import {
  createConnection,
  TextDocuments,
  ProposedFeatures,
  TextDocumentSyncKind,
  CompletionItem,
  InitializeParams,
  InitializeResult,
  CompletionParams,
  CompletionList,
  Hover,
  TextDocumentPositionParams,
  DidChangeConfigurationNotification,
} from 'vscode-languageserver'
import getTailwindState from 'tailwindcss-class-names'
import { State, Settings } from './util/state'
import {
  provideCompletions,
  resolveCompletionItem,
} from './providers/completionProvider'
import { provideHover } from './providers/hoverProvider'
import { URI } from 'vscode-uri'
import { getDocumentSettings } from './util/getDocumentSettings'

let state: State = null
let connection = createConnection(ProposedFeatures.all)
let documents = new TextDocuments()
let workspaceFolder: string | null

const defaultSettings: Settings = { emmetCompletions: false }
let globalSettings: Settings = defaultSettings
let documentSettings: Map<string, Settings> = new Map()

documents.onDidOpen((event) => {
  getDocumentSettings(state, event.document.uri)
})
documents.onDidClose((event) => {
  documentSettings.delete(event.document.uri)
})
documents.listen(connection)

connection.onInitialize(
  async (params: InitializeParams): Promise<InitializeResult> => {
    state = await getTailwindState(
      params.rootPath || URI.parse(params.rootUri).path,
      {
        onChange: (newState: State): void => {
          state = { ...newState, editor: state.editor }
          connection.sendNotification('tailwindcss/configUpdated', [
            state.dependencies[0],
            state.config,
            state.plugins,
          ])
        },
      }
    )

    const capabilities = params.capabilities

    state.editor = {
      connection,
      documents,
      documentSettings,
      globalSettings,
      capabilities: { configuration: capabilities.workspace && !!capabilities.workspace.configuration },
    }

    return {
      capabilities: {
        // textDocumentSync: {
        //   openClose: true,
        //   change: TextDocumentSyncKind.None
        // },
        textDocumentSync: documents.syncKind,
        completionProvider: {
          resolveProvider: true,
          triggerCharacters: ['"', "'", '`', ' ', '.', '[', state.separator],
        },
        hoverProvider: true,
      },
    }
  }
)

connection.onInitialized &&
  connection.onInitialized(async () => {
    if (state.editor.capabilities.configuration) {
      connection.client.register(
        DidChangeConfigurationNotification.type,
        undefined
      )
    }

    connection.sendNotification('tailwindcss/configUpdated', [
      state.dependencies[0],
      state.config,
      state.plugins,
    ])
  })

connection.onDidChangeConfiguration((change) => {
  if (state.editor.capabilities.configuration) {
    // Reset all cached document settings
    state.editor.documentSettings.clear()
  } else {
    state.editor.globalSettings = <Settings>(
      (change.settings.tailwindCSS || defaultSettings)
    )
  }

  state.editor.documents
    .all()
    .forEach((doc) => getDocumentSettings(state, doc.uri))
})

connection.onCompletion(
  (params: CompletionParams): Promise<CompletionList> => {
    return provideCompletions(state, params)
  }
)

connection.onCompletionResolve(
  (item: CompletionItem): CompletionItem => {
    return resolveCompletionItem(state, item)
  }
)

connection.onHover(
  (params: TextDocumentPositionParams): Hover => {
    return provideHover(state, params)
  }
)

connection.listen()
