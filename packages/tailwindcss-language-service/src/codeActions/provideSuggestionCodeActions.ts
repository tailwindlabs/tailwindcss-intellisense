import { State } from '../util/state'
import type {
  CodeActionParams,
  CodeAction,
} from 'vscode-languageserver'
import {
  InvalidConfigPathDiagnostic,
  InvalidTailwindDirectiveDiagnostic,
  InvalidScreenDiagnostic,
  InvalidVariantDiagnostic,
} from '../diagnostics/types'

export function provideSuggestionCodeActions(
  _state: State,
  params: CodeActionParams,
  diagnostic:
    | InvalidConfigPathDiagnostic
    | InvalidTailwindDirectiveDiagnostic
    | InvalidScreenDiagnostic
    | InvalidVariantDiagnostic
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
