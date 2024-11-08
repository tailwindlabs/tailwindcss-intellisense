import type { State, Settings } from '../util/state'
import { type DeprecatedClassDiagnostic } from './types'
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

  let diagnostics: DeprecatedClassDiagnostic[] = []

  return diagnostics
}
