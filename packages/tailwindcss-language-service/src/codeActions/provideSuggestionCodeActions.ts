import type { State } from '../util/state'
import type { CodeActionParams, CodeAction } from 'vscode-languageserver'
import type {
  InvalidConfigPathDiagnostic,
  InvalidTailwindDirectiveDiagnostic,
  InvalidScreenDiagnostic,
  InvalidVariantDiagnostic,
  RecommendedVariantOrderDiagnostic,
} from '../diagnostics/types'

export function provideSuggestionCodeActions(
  _state: State,
  params: CodeActionParams,
  diagnostic:
    | InvalidConfigPathDiagnostic
    | InvalidTailwindDirectiveDiagnostic
    | InvalidScreenDiagnostic
    | InvalidVariantDiagnostic
    | RecommendedVariantOrderDiagnostic,
): CodeAction[] {
  return diagnostic.suggestions.map((suggestion) => ({
    title: `Replace with '${suggestion}'`,
    kind: 'quickfix', // CodeActionKind.QuickFix,
    diagnostics: [diagnostic],
    edit: {
      changes: {
        [params.textDocument.uri]: [
          {
            range: diagnostic.range,
            newText: suggestion,
          },
        ],
      },
    },
  }))
}
