import type { TextDocument } from 'vscode-languageserver-textdocument'
import { findClassNamesInRange } from '../util/find'
import { type InvalidApplyDiagnostic, DiagnosticKind } from './types'
import type { Settings, State } from '../util/state'
import { validateApply } from '../util/validateApply'

export async function getInvalidApplyDiagnostics(
  state: State,
  document: TextDocument,
  settings: Settings,
): Promise<InvalidApplyDiagnostic[]> {
  let severity = settings.tailwindCSS.lint.invalidApply
  if (severity === 'ignore') return []

  const classNames = await findClassNamesInRange(state, document, undefined, 'css', false)

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
