import type { State, Settings } from '../util/state'
import { type DeprecatedClassDiagnostic, DiagnosticKind } from './types'
import { findClassListsInDocument, getClassNamesInClassList } from '../util/find'
import type { TextDocument } from 'vscode-languageserver-textdocument'

export async function getDeprecatedClassDiagnostics(
  state: State,
  document: TextDocument,
  settings: Settings,
): Promise<DeprecatedClassDiagnostic[]> {
  // Only v4 projects can report deprecations
  if (!state.v4) return []

  // This is an earlier v4 version that does not support class deprecations
  if (!state.designSystem.classMetadata) return []

  let severity = settings.tailwindCSS.lint.deprecatedClass
  if (severity === 'ignore') return []

  // Fill in the list of statically known deprecated classes
  let deprecations = new Map<string, boolean>(
    state.classList.map(([className, meta]) => [className, meta.deprecated ?? false]),
  )

  function isDeprecated(className: string) {
    if (deprecations.has(className)) {
      return deprecations.get(className)
    }

    let metadata = state.designSystem.classMetadata([className])[0]
    let deprecated = metadata?.deprecated ?? false

    deprecations.set(className, deprecated)

    return deprecated
  }

  let diagnostics: DeprecatedClassDiagnostic[] = []
  let classLists = await findClassListsInDocument(state, document)

  for (let classList of classLists) {
    let classNames = getClassNamesInClassList(classList, state.blocklist)

    for (let className of classNames) {
      if (!isDeprecated(className.className)) continue

      diagnostics.push({
        code: DiagnosticKind.DeprecatedClass,
        className,
        range: className.range,
        severity:
          severity === 'error'
            ? 1 /* DiagnosticSeverity.Error */
            : 2 /* DiagnosticSeverity.Warning */,
        message: `'${className.className}' is deprecated.`,
        suggestions: [],
      })
    }
  }

  return diagnostics
}
