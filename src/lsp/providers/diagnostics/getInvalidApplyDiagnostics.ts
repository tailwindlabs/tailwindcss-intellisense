import { findClassNamesInRange } from '../../util/find'
import { InvalidApplyDiagnostic, DiagnosticKind } from './types'
import { Settings, State } from '../../util/state'
import { TextDocument, DiagnosticSeverity } from 'vscode-languageserver'
import { getClassNameMeta } from '../../util/getClassNameMeta'

export function getInvalidApplyDiagnostics(
  state: State,
  document: TextDocument,
  settings: Settings
): InvalidApplyDiagnostic[] {
  let severity = settings.lint.invalidApply
  if (severity === 'ignore') return []

  const classNames = findClassNamesInRange(document, undefined, 'css')

  let diagnostics: InvalidApplyDiagnostic[] = classNames.map((className) => {
    const meta = getClassNameMeta(state, className.className)
    if (!meta) return null

    let message: string

    if (Array.isArray(meta)) {
      message = `'@apply' cannot be used with '${className.className}' because it is included in multiple rulesets.`
    } else if (meta.source !== 'utilities') {
      message = `'@apply' cannot be used with '${className.className}' because it is not a utility.`
    } else if (meta.context && meta.context.length > 0) {
      if (meta.context.length === 1) {
        message = `'@apply' cannot be used with '${className.className}' because it is nested inside of an at-rule ('${meta.context[0]}').`
      } else {
        message = `'@apply' cannot be used with '${
          className.className
        }' because it is nested inside of at-rules (${meta.context
          .map((c) => `'${c}'`)
          .join(', ')}).`
      }
    } else if (meta.pseudo && meta.pseudo.length > 0) {
      if (meta.pseudo.length === 1) {
        message = `'@apply' cannot be used with '${className.className}' because its definition includes a pseudo-selector ('${meta.pseudo[0]}')`
      } else {
        message = `'@apply' cannot be used with '${
          className.className
        }' because its definition includes pseudo-selectors (${meta.pseudo
          .map((p) => `'${p}'`)
          .join(', ')}).`
      }
    }

    if (!message) return null

    return {
      code: DiagnosticKind.InvalidApply,
      severity:
        severity === 'error'
          ? DiagnosticSeverity.Error
          : DiagnosticSeverity.Warning,
      range: className.range,
      message,
      className,
    }
  })

  return diagnostics.filter(Boolean)
}
