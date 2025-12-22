import type { CodeAction, CodeActionParams } from 'vscode-languageserver'
import type { TextDocument } from 'vscode-languageserver-textdocument'
import type { State } from '../util/state'
import { doValidate } from '../diagnostics/diagnosticsProvider'
import { rangesEqual } from '../util/rangesEqual'
import {
  DiagnosticKind,
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
import { provideFixAllSuggestionCodeAction } from './provideFixAllSuggestionCodeAction'
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

function getCodeActionContextInfo(params: CodeActionParams) {
  let only = params.context.only
  let isFixAllKind = (kind: string) => kind === 'source.fixAll' || kind.startsWith('source.fixAll.')

  return {
    onlyFixAll: !!only?.length && only.every(isFixAllKind),
    includeFixAllKind: !only || only.some((kind) => kind === 'source' || isFixAllKind(kind)),
    includeQuickFix: !only || only.includes('quickfix'),
  }
}

export async function doCodeActions(
  state: State,
  params: CodeActionParams,
  document: TextDocument,
): Promise<CodeAction[]> {
  if (!state.enabled) {
    return []
  }

  let { onlyFixAll, includeFixAllKind, includeQuickFix } = getCodeActionContextInfo(params)

  let fixAllActions: CodeAction[] = []
  let hasCanonicalContextDiagnostic = params.context.diagnostics.some(
    (diagnostic) => diagnostic.code === DiagnosticKind.SuggestCanonicalClasses,
  )

  if (includeFixAllKind || (includeQuickFix && hasCanonicalContextDiagnostic)) {
    let fixAllDiagnostics = await doValidate(state, document, [
      DiagnosticKind.SuggestCanonicalClasses,
    ])

    let canonicalDiagnostics = fixAllDiagnostics.filter(isSuggestCanonicalClasses)

    if (includeFixAllKind) {
      fixAllActions = fixAllActions.concat(
        provideFixAllSuggestionCodeAction(params, canonicalDiagnostics),
      )
    }

    if (includeQuickFix && hasCanonicalContextDiagnostic) {
      fixAllActions = fixAllActions.concat(
        provideFixAllSuggestionCodeAction(
          params,
          canonicalDiagnostics,
          'quickfix',
          'Fix all canonical class suggestions',
        ),
      )
    }
  }

  if (onlyFixAll) {
    return fixAllActions
  }

  if (!includeQuickFix) {
    return fixAllActions
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
    .then((x) => fixAllActions.concat(x))
}
