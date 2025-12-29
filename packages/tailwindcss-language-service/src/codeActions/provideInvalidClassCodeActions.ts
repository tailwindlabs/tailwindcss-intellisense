import type { CodeAction, CodeActionParams } from 'vscode-languageserver'
import type { State } from '../util/state'
import type { InvalidClassDiagnostic } from '../diagnostics/types'
import { removeRangesFromString } from '../util/removeRangesFromString'

export function provideInvalidClassCodeActions(
  _state: State,
  params: CodeActionParams,
  diagnostic: InvalidClassDiagnostic,
): CodeAction[] {
  return [
    {
      title: `Remove unknown utility class '${diagnostic.className.className}'`,
      kind: 'quickfix',
      diagnostics: [diagnostic],
      edit: {
        changes: {
          [params.textDocument.uri]: [
            {
              range: diagnostic.className.classList.range,
              newText: removeRangesFromString(
                diagnostic.className.classList.classList,
                [diagnostic.className.relativeRange],
              ),
            },
          ],
        },
      },
    },
  ]
}