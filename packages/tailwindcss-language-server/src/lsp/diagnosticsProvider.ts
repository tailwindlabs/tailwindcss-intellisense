import type { TextDocument } from 'vscode-languageserver-textdocument'
import type { State } from '@tailwindcss/language-service/src/util/state'
import type { LanguageService } from '@tailwindcss/language-service/src/service'

export async function provideDiagnostics(
  service: LanguageService,
  state: State,
  document: TextDocument,
) {
  if (!state.enabled) return
  let doc = await service.open(document.uri)
  let diagnostics = await doc?.diagnostics()

  state.editor?.connection.sendDiagnostics({
    uri: document.uri,
    diagnostics: diagnostics ?? [],
  })
}
