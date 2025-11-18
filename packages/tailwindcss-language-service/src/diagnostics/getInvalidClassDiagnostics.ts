import type { State, Settings, DocumentClassName } from '../util/state'
import { type InvalidClassDiagnostic, DiagnosticKind } from './types'
import { findClassListsInDocument, getClassNamesInClassList } from '../util/find'
import { visit } from './getCssConflictDiagnostics'
import type { TextDocument } from 'vscode-languageserver-textdocument'

function isClassValid(state: State, className: string): boolean {
  if (!state.v4) return true // Only check for v4

  let roots = state.designSystem.compile([className])
  let hasDeclarations = false

  visit([roots[0]], (node) => {
    if ((node.type === 'rule' || node.type === 'atrule') && node.nodes) {
      for (let child of node.nodes) {
        if (child.type === 'decl') {
          hasDeclarations = true
          break
        }
      }
    }
  })

  return hasDeclarations
}

export async function getInvalidClassDiagnostics(
  state: State,
  document: TextDocument,
  settings: Settings,
): Promise<InvalidClassDiagnostic[]> {
  let severity = settings.tailwindCSS.lint.invalidClass || 'warning' // Assuming a new setting, default to warning
  if (severity === 'ignore') return []

  let diagnostics: InvalidClassDiagnostic[] = []
  const classLists = await findClassListsInDocument(state, document)

  classLists.forEach((classList) => {
    const classNames = getClassNamesInClassList(classList, state.blocklist)

    classNames.forEach((className) => {
      if (!isClassValid(state, className.className)) {
        diagnostics.push({
          code: DiagnosticKind.InvalidClass,
          source: 'tailwindcss',
          className,
          range: className.range,
          severity:
            severity === 'error'
              ? 1 /* DiagnosticSeverity.Error */
              : severity === 'warning'
              ? 2 /* DiagnosticSeverity.Warning */
              : 3 /* DiagnosticSeverity.Information */,
          message: `'${className.className}' is not a recognized Tailwind CSS class.`,
        })
      }
    })
  })

  return diagnostics
}