import { State } from '../../util/state'
import {
  CodeActionParams,
  CodeAction,
  CodeActionKind,
} from 'vscode-languageserver'
import { CssConflictDiagnostic } from '../diagnostics/types'
import { joinWithAnd } from '../../util/joinWithAnd'
import { removeRangesFromString } from '../../util/removeRangesFromString'

export async function provideCssConflictCodeActions(
  _state: State,
  params: CodeActionParams,
  diagnostic: CssConflictDiagnostic
): Promise<CodeAction[]> {
  return [
    {
      title: `Delete ${joinWithAnd(
        diagnostic.otherClassNames.map(
          (otherClassName) => `'${otherClassName.className}'`
        )
      )}`,
      kind: CodeActionKind.QuickFix,
      diagnostics: [diagnostic],
      edit: {
        changes: {
          [params.textDocument.uri]: [
            {
              range: diagnostic.className.classList.range,
              newText: removeRangesFromString(
                diagnostic.className.classList.classList,
                diagnostic.otherClassNames.map(
                  (otherClassName) => otherClassName.relativeRange
                )
              ),
            },
          ],
        },
      },
    },
  ]
}
