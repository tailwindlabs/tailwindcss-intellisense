import { findClassNamesInRange } from '../../util/find'
import { InvalidApplyDiagnostic, DiagnosticKind } from './types'
import { Settings, State } from '../../util/state'
import { TextDocument, DiagnosticSeverity } from 'vscode-languageserver'
import { validateApply } from '../../util/validateApply'
import { flagEnabled } from '../../util/flagEnabled'

export function getInvalidApplyDiagnostics(
  state: State,
  document: TextDocument,
  settings: Settings
): InvalidApplyDiagnostic[] {
  let severity = settings.lint.invalidApply
  if (severity === 'ignore') return []
  if (flagEnabled(state, 'applyComplexClasses')) return []

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
          ? DiagnosticSeverity.Error
          : DiagnosticSeverity.Warning,
      range: className.range,
      message: result.reason,
      className,
    }
  })

  return diagnostics.filter(Boolean)
}
