import type { CodeAction, CodeActionParams } from 'vscode-languageserver'
import type { SuggestCanonicalClassesDiagnostic } from '../diagnostics/types'
import { dedupeByRange } from '../util/array'

export const FIX_ALL_SUGGESTION_KIND = 'source.fixAll.tailwindcss'

export function provideFixAllSuggestionCodeAction(
  params: CodeActionParams,
  diagnostics: SuggestCanonicalClassesDiagnostic[],
  kind: string = FIX_ALL_SUGGESTION_KIND,
  title: string = 'Fix all canonical class suggestions',
): CodeAction[] {
  let edits = dedupeByRange(
    diagnostics
      .filter((diagnostic) => diagnostic.suggestions.length > 0)
      .map((diagnostic) => ({
        range: diagnostic.range,
        newText: diagnostic.suggestions[0],
      })),
  )

  if (edits.length === 0) return []

  return [
    {
      title,
      kind,
      edit: {
        changes: {
          [params.textDocument.uri]: edits,
        },
      },
    },
  ]
}
