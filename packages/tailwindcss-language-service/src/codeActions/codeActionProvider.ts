import type { CodeAction, CodeActionParams } from 'vscode-languageserver'
import type { TextDocument } from 'vscode-languageserver-textdocument'
import type { State } from '../util/state'
import { doValidate } from '../diagnostics/diagnosticsProvider'
import { rangesEqual } from '../util/rangesEqual'
import {
  type DiagnosticKind,
  isInvalidApplyDiagnostic,
  type AugmentedDiagnostic,
  isCssConflictDiagnostic,
  isInvalidConfigPathDiagnostic,
  isInvalidTailwindDirectiveDiagnostic,
  isInvalidScreenDiagnostic,
  isInvalidVariantDiagnostic,
  isRecommendedVariantOrderDiagnostic,
  isSuggestCanonicalClasses,
} from '../diagnostics/types'
import { flatten, dedupeBy } from '../util/array'
import { provideCssConflictCodeActions } from './provideCssConflictCodeActions'
import { provideInvalidApplyCodeActions } from './provideInvalidApplyCodeActions'
import { provideSuggestionCodeActions } from './provideSuggestionCodeActions'

async function getDiagnosticsFromCodeActionParams(
  state: State,
  params: CodeActionParams,
  document: TextDocument,
  only?: DiagnosticKind[],
): Promise<AugmentedDiagnostic[]> {
  if (!document) return []
  let diagnostics = await doValidate(state, document, only)

  return params.context.diagnostics
    .map((diagnostic) => {
      return diagnostics.find((d) => {
        return (
          d.code === diagnostic.code &&
          d.message === diagnostic.message &&
          rangesEqual(d.range, diagnostic.range)
        )
      })
    })
    .filter(Boolean)
}

export async function doCodeActions(
  state: State,
  params: CodeActionParams,
  document: TextDocument,
): Promise<CodeAction[]> {
  if (!state.enabled) {
    return []
  }

  let diagnostics = await getDiagnosticsFromCodeActionParams(
    state,
    params,
    document,
    params.context.diagnostics
      .map((diagnostic) => diagnostic.code)
      .filter(Boolean) as DiagnosticKind[],
  )

  return Promise.all(
    diagnostics.map((diagnostic) => {
      if (isInvalidApplyDiagnostic(diagnostic)) {
        return provideInvalidApplyCodeActions(state, document, diagnostic)
      }

      if (isCssConflictDiagnostic(diagnostic)) {
        return provideCssConflictCodeActions(state, params, diagnostic)
      }

      if (
        isInvalidConfigPathDiagnostic(diagnostic) ||
        isInvalidTailwindDirectiveDiagnostic(diagnostic) ||
        isInvalidScreenDiagnostic(diagnostic) ||
        isInvalidVariantDiagnostic(diagnostic) ||
        isRecommendedVariantOrderDiagnostic(diagnostic) ||
        isSuggestCanonicalClasses(diagnostic)
      ) {
        return provideSuggestionCodeActions(state, params, diagnostic)
      }

      return []
    }),
  )
    .then(flatten)
    .then((x) => dedupeBy(x, (item) => JSON.stringify(item.edit)))
}
