import type { TextDocument } from 'vscode-languageserver-textdocument'
import type { State, Settings } from '../util/state'
import { type SuggestCanonicalClassesDiagnostic, DiagnosticKind } from './types'
import { findClassListsInDocument, getClassNamesInClassList } from '../util/find'

export async function getSuggestCanonicalClassesDiagnostics(
  state: State,
  document: TextDocument,
  settings: Settings,
): Promise<SuggestCanonicalClassesDiagnostic[]> {
  if (!state.v4) return []
  if (!state.designSystem.canonicalizeCandidates) return []

  let severity = settings.tailwindCSS.lint.suggestCanonicalClasses
  if (severity === 'ignore') return []

  let diagnostics: SuggestCanonicalClassesDiagnostic[] = []

  let classLists = await findClassListsInDocument(state, document)

  for (let classList of classLists) {
    let classNames = getClassNamesInClassList(classList, [])

    // NOTES:
    //
    // A planned enhancement to `canonicalizeCandidates` is to operate on class *lists* which would
    // allow `[font-size:0.875rem] [line-height:0.25rem]` to turn into a single `text-sm/3` class.
    //
    // To account for this future we process class names individually. At some future point we can
    // then take the list of individual classes and pass it in *again* to issue a diagnostic for the
    // class list as a whole.
    //
    // This may not allow you to see *which classes* got combined since the inputs/outputs map to
    // entire lists but this seems fine to do
    //
    // We'd probably want to only issue a class list diagnostic once there are no individual class
    // diagnostics in a given class list.

    for (let className of classNames) {
      let canonicalized = state.designSystem.canonicalizeCandidates([className.className], {
        rem: settings.tailwindCSS.rootFontSize,
      })[0]
      let isCanonical = canonicalized === className.className

      if (isCanonical) continue

      diagnostics.push({
        code: DiagnosticKind.SuggestCanonicalClasses,
        source: 'tailwindcss',
        range: className.range,
        severity:
          severity === 'error'
            ? 1 /* DiagnosticSeverity.Error */
            : 2 /* DiagnosticSeverity.Warning */,
        message: `The class \`${className.className}\` can be written as \`${canonicalized}\``,
        suggestions: [canonicalized],
      })
    }
  }

  return diagnostics
}
