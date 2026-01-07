import type { TextDocument } from 'vscode-languageserver-textdocument'
import type { State, Settings } from '../util/state'
import { type SuggestGapUtilitiesDiagnostic, DiagnosticKind } from './types'
import { findClassListsInDocument, getClassNamesInClassList } from '../util/find'

const SPACE_REGEX = /^-?space-([xy])-(.+)$/
type FlexAxis = 'x' | 'y' | null

function getFlexAxis(classes: string[]): FlexAxis {
  if (classes.includes('flex-col')) return 'y'
  if (classes.includes('flex') || classes.includes('flex-row')) return 'x'
  return null
}

export async function getSuggestGapUtilitiesDiagnostics(
  state: State,
  document: TextDocument,
  settings: Settings,
): Promise<SuggestGapUtilitiesDiagnostic[]> {
  const severity = settings.tailwindCSS.lint.suggestGapUtilities
  if (severity === 'ignore') return []

  const diagnostics: SuggestGapUtilitiesDiagnostic[] = []
  const classLists = await findClassListsInDocument(state, document)

  for (const classList of classLists) {
    const classNames = getClassNamesInClassList(classList, [])
    const allClasses = classNames.map((c) => c.className)

    if (allClasses.some((c) => c.endsWith('-reverse'))) continue
    const axis = getFlexAxis(allClasses)
    if (!axis) continue

    for (const classInfo of classNames) {
      const { className, range } = classInfo
      const match = className.match(SPACE_REGEX)
      if (!match) continue

      const [, spaceAxis, value] = match
      if (className.startsWith('-') || value.startsWith('[') || spaceAxis !== axis) continue

      const suggestion = `gap-${spaceAxis}-${value}`

      diagnostics.push({
        code: DiagnosticKind.SuggestGapUtilities,
        source: 'tailwindcss',
        range,
        severity:
          severity === 'error'
            ? 1 /* DiagnosticSeverity.Error */
            : 2 /* DiagnosticSeverity.Warning */,
        message: `Consider using \`${suggestion}\` instead of \`${className}\` when using flex layouts.`,
        suggestions: [suggestion],
      })
    }
  }

  return diagnostics
}
