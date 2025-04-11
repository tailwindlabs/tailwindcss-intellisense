import type { TextDocument } from 'vscode-languageserver-textdocument'
import type { State, Settings } from '../util/state'
import { type UsedBlocklistedClassDiagnostic, DiagnosticKind } from './types'
import { findClassListsInDocument, getClassNamesInClassList } from '../util/find'

export async function getUsedBlocklistedClassDiagnostics(
  state: State,
  document: TextDocument,
  settings: Settings,
): Promise<UsedBlocklistedClassDiagnostic[]> {
  if (!state.v4) return []
  if (!state.blocklist?.length) return []

  let severity = settings.tailwindCSS.lint.usedBlocklistedClass
  if (severity === 'ignore') return []

  let blocklist = new Set(state.blocklist ?? [])
  let diagnostics: UsedBlocklistedClassDiagnostic[] = []

  let classLists = await findClassListsInDocument(state, document)

  for (let classList of classLists) {
    let classNames = getClassNamesInClassList(classList, [])

    for (let className of classNames) {
      if (!blocklist.has(className.className)) continue

      diagnostics.push({
        code: DiagnosticKind.UsedBlocklistedClass,
        range: className.range,
        severity:
          severity === 'error'
            ? 1 /* DiagnosticSeverity.Error */
            : 2 /* DiagnosticSeverity.Warning */,
        message: `The class "${className.className}" will not be generated as it has been blocklisted`,
      })
    }
  }

  return diagnostics
}
