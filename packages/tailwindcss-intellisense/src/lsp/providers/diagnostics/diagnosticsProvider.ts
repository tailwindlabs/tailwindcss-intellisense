import { TextDocument } from 'vscode-languageserver'
import { State } from '../../util/state'
import { doValidate } from 'tailwindcss-language-service'

export async function provideDiagnostics(state: State, document: TextDocument) {
  state.editor.connection.sendDiagnostics({
    uri: document.uri,
    diagnostics: await doValidate(state, document),
  })
}

export function clearDiagnostics(state: State, document: TextDocument): void {
  state.editor.connection.sendDiagnostics({
    uri: document.uri,
    diagnostics: [],
  })
}

export function clearAllDiagnostics(state: State): void {
  state.editor.documents.all().forEach((document) => {
    clearDiagnostics(state, document)
  })
}

export function updateAllDiagnostics(state: State): void {
  state.editor.documents.all().forEach((document) => {
    provideDiagnostics(state, document)
  })
}
