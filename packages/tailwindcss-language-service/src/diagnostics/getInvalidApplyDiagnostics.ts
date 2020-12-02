import { findClassNamesInRange } from '../util/find'
import { InvalidApplyDiagnostic, DiagnosticKind } from './types'
import { Settings, State } from '../util/state'
import type { TextDocument, DiagnosticSeverity } from 'vscode-languageserver'
import { validateApply } from '../util/validateApply'

export function getInvalidApplyDiagnostics(
  state: State,
  document: TextDocument,
  settings: Settings
): InvalidApplyDiagnostic[] {
  let severity = settings.lint.invalidApply
  if (severity === 'ignore') return []

  const classNames = findClassNamesInRange(document, undefined, 'css')

  let diagnostics: InvalidApplyDiagnostic[] = classNames.map((className) => {
    let result = validateApply(state, className.className)

    if (result === null || result.isApplyable === true) {
      return null
    }

    return {
      code: DiagnosticKind.InvalidApply,
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
