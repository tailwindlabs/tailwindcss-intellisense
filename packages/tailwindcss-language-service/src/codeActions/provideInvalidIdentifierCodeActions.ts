import { State } from '../util/state'
import type {
  CodeActionParams,
  CodeAction,
} from 'vscode-languageserver'
import { CssConflictDiagnostic, InvalidIdentifierDiagnostic } from '../diagnostics/types'
import { joinWithAnd } from '../util/joinWithAnd'
import { removeRangesFromString } from '../util/removeRangesFromString'

export async function provideInvalidIdentifierCodeActions(
  _state: State,
  params: CodeActionParams,
  diagnostic: InvalidIdentifierDiagnostic
): Promise<CodeAction[]> {
	if (!diagnostic.suggestion) return [];
	
	debugger;
  return [
    {
      title: `Replace with '${diagnostic.suggestion}'`,
      kind: 'quickfix', // CodeActionKind.QuickFix,
      diagnostics: [diagnostic],
      edit: {
        changes: {
          [params.textDocument.uri]: [
            {
              range: diagnostic.range,
              newText: diagnostic.suggestion,
            },
          ],
        },
      },
    },
  ]
}
