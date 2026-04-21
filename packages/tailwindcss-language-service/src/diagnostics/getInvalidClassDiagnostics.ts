import type { State, Settings } from '../util/state'
import { type InvalidClassDiagnostic, DiagnosticKind } from './types'
import { findClassListsInDocument, getClassNamesInClassList } from '../util/find'
import * as jit from '../util/jit'
import type { TextDocument } from 'vscode-languageserver-textdocument'

function isClassValid(state: State, className: string): boolean {
  if (state.v4) {
    return state.designSystem.compile([className])[0].length > 0
  } else if (state.jit) {
    // JIT: Try to generate rules
    let { rules } = jit.generateRules(state, [className])
    return rules.length > 0
  } else {
    return false
  }
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
          message: `Unknown utility class '${className.className}'.`,
        })
      }
    })
  })

  return diagnostics
}
