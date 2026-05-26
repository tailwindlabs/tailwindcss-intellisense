import type { TextDocument } from 'vscode-languageserver-textdocument'
import { findClassListsInDocument, getClassNamesInClassList } from '../util/find'
import { type InvalidApplyDiagnostic, DiagnosticKind } from './types'
import type { Settings, State } from '../util/state'
import { validateApply } from '../util/validateApply'
import { isCssDoc } from '../util/css'

export function getInvalidApplyDiagnostics(
  state: State,
  document: TextDocument,
  settings: Settings,
): InvalidApplyDiagnostic[] {
  let severity = settings.tailwindCSS.lint.invalidApply
  if (severity === 'ignore') return []
  if (!isCssDoc(state, document)) return []

  const classLists = findClassListsInDocument(state, document, settings)
  const classNames = classLists.flatMap((classList) =>
    getClassNamesInClassList(classList, state.blocklist),
  )

  let diagnostics: InvalidApplyDiagnostic[] = classNames.map((className) => {
    let result = validateApply(state, className.className)

    if (result === null || result.isApplyable === true) {
      return null
    }

    return {
      code: DiagnosticKind.InvalidApply,
      source: 'tailwindcss',
      severity:
        severity === 'error'
          ? 1 /* DiagnosticSeverity.Error */
          : 2 /* DiagnosticSeverity.Warning */,
      range: className.range,
      message: result.reason,
      className,
    }
  })

  return diagnostics.filter(Boolean)
}
