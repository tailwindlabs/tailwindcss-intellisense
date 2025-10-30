import type { TextDocument } from 'vscode-languageserver-textdocument'
import type { State, Settings } from '../util/state'
import { type UnknownClassesDiagnostic, DiagnosticKind } from './types'
import { findClassListsInDocument, getClassNamesInClassList } from '../util/find'
import { DiagnosticTag } from 'vscode-languageserver'

export async function getUnknownClassesDiagnostics(
  state: State,
  document: TextDocument,
  settings: Settings,
): Promise<UnknownClassesDiagnostic[]> {
  if (!state.v4) return []

  let severity = settings.tailwindCSS.lint.unknownClasses
  if (severity === 'ignore') return []

  let diagnostics: UnknownClassesDiagnostic[] = []

  let classLists = await findClassListsInDocument(state, document)

  for (let classList of classLists) {
    let classNames = getClassNamesInClassList(classList, [])

    for (let className of classNames) {
      let exists = state.designSystem.compile([className.className])
      if (exists[0].nodes.length) continue

      diagnostics.push({
        code: DiagnosticKind.UnknownClasses,
        range: className.range,
        tags: [DiagnosticTag.Unnecessary],
        severity:
          severity === 'error' ? 1 /* DiagnosticSeverity.Error */ : 4 /* DiagnosticSeverity.Hint */,
        message: `The class \`${className.className}\` does not exist.`,
      })
    }
  }

  return diagnostics
}
