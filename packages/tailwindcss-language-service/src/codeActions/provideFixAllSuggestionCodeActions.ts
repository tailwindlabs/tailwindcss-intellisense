import type { CodeAction, TextEdit } from 'vscode-languageserver'
import type { TextDocument } from 'vscode-languageserver-textdocument'
import { doValidate } from '../diagnostics/diagnosticsProvider'
import { DiagnosticKind, isSuggestCanonicalClasses } from '../diagnostics/types'
import type { State } from '../util/state'

const SOURCE_FIX_ALL_TAILWIND_KIND = 'source.fixAll.tailwindcss'

export async function provideFixAllSuggestionCodeActions(
  state: State,
  document: TextDocument,
): Promise<CodeAction[]> {
  let diagnostics = await doValidate(state, document, [DiagnosticKind.SuggestCanonicalClasses])
  let canonicalDiagnostics = diagnostics.filter(isSuggestCanonicalClasses)

  if (canonicalDiagnostics.length === 0) {
    return []
  }

  let changes = canonicalDiagnostics.reduce<TextEdit[]>((all, diagnostic) => {
    let suggestion = diagnostic.suggestions[0]
    if (!suggestion) return all

    all.push({
      range: diagnostic.range,
      newText: suggestion,
    })

    return all
  }, [])

  if (changes.length === 0) {
    return []
  }

  return [
    {
      title: 'Fix all Tailwind CSS canonical class suggestions',
      kind: SOURCE_FIX_ALL_TAILWIND_KIND,
      diagnostics: canonicalDiagnostics,
      edit: {
        changes: {
          [document.uri]: changes,
        },
      },
    },
  ]
}
