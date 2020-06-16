import {
  CodeAction,
  CodeActionParams,
  CodeActionKind,
} from 'vscode-languageserver'
import { State } from '../util/state'
import { findLast } from '../util/find'

export function provideCodeActions(
  _state: State,
  params: CodeActionParams
): CodeAction[] {
  if (params.context.diagnostics.length === 0) {
    return null
  }

  return params.context.diagnostics
    .map((diagnostic) => {
      let match = findLast(
        / Did you mean (?:something like )?'(?<replacement>[^']+)'\?$/g,
        diagnostic.message
      )

      if (!match) {
        return null
      }

      return {
        title: `Replace with '${match.groups.replacement}'`,
        kind: CodeActionKind.QuickFix,
        diagnostics: [diagnostic],
        edit: {
          changes: {
            [params.textDocument.uri]: [
              {
                range: diagnostic.range,
                newText: match.groups.replacement,
              },
            ],
          },
        },
      }
    })
    .filter(Boolean)
}
