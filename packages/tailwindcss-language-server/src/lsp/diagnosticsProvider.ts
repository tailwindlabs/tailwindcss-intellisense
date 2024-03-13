import type { TextDocument } from 'vscode-languageserver-textdocument'
import type { State } from '@tailwindcss/language-service/src/util/state'
import { doValidate } from '@tailwindcss/language-service/src/diagnostics/diagnosticsProvider'
import isExcluded from '../util/isExcluded'

export async function provideDiagnostics(state: State, document: TextDocument) {
  if (await isExcluded(state, document)) {
    clearDiagnostics(state, document)
  } else {
    state.editor?.connection.sendDiagnostics({
      uri: document.uri,
      diagnostics: await doValidate(state, document),
    })
  }
}

export function clearDiagnostics(state: State, document: TextDocument): void {
  state.editor?.connection.sendDiagnostics({
    uri: document.uri,
    diagnostics: [],
  })
}
