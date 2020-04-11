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
} from 'vscode-languageserver'
import getTailwindState from 'tailwindcss-class-names'
import { State } from './util/state'
import {
  provideCompletions,
  resolveCompletionItem,
} from './providers/completionProvider'
import { URI } from 'vscode-uri'

let state: State = null
let connection = createConnection(ProposedFeatures.all)
let documents = new TextDocuments()
let workspaceFolder: string | null

documents.onDidOpen((event) => {
  connection.console.log(
    `[Server(${process.pid}) ${workspaceFolder}] Document opened: ${event.document.uri}`
  )
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
    state.editor = { connection, documents }

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
      },
    }
  }
)

connection.onInitialized &&
  connection.onInitialized(async () => {
    connection.sendNotification('tailwindcss/configUpdated', [
      state.dependencies[0],
      state.config,
      state.plugins,
    ])
  })

connection.onCompletion(
  (params: CompletionParams): CompletionList => {
    return provideCompletions(state, params)
  }
)

connection.onCompletionResolve(
  (item: CompletionItem): CompletionItem => {
    return resolveCompletionItem(state, item)
  }
)

connection.listen()
