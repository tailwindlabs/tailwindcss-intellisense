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
  let report = await doc?.diagnostics()

  // No need to send diagnostics if the document is unchanged
  if (report.kind === 'unchanged') return

  state.editor?.connection.sendDiagnostics({
    uri: document.uri,
    diagnostics: report?.items ?? [],
  })
}
