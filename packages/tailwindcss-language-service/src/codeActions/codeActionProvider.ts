import type { CodeAction, CodeActionParams } from 'vscode-languageserver'
import type { TextDocument } from 'vscode-languageserver-textdocument'
import type { State } from '../util/state'
import { doValidate } from '../diagnostics/diagnosticsProvider'
import { rangesEqual } from '../util/rangesEqual'
import {
  type DiagnosticKind,
  DiagnosticKind as DiagnosticKindEnum,
  isInvalidApplyDiagnostic,
  type AugmentedDiagnostic,
  isCssConflictDiagnostic,
  isInvalidConfigPathDiagnostic,
  isInvalidTailwindDirectiveDiagnostic,
  isInvalidScreenDiagnostic,
  isInvalidVariantDiagnostic,
  isDeprecatedAtRuleDiagnostic,
  isRecommendedVariantOrderDiagnostic,
  isSuggestCanonicalClasses,
} from '../diagnostics/types'
import { flatten } from '../util/array'
import { provideCssConflictCodeActions } from './provideCssConflictCodeActions'
import { provideFixAllSuggestionCodeActions } from './provideFixAllSuggestionCodeActions'
import { provideInvalidApplyCodeActions } from './provideInvalidApplyCodeActions'
import { provideSuggestionCodeActions } from './provideSuggestionCodeActions'

const QUICK_FIX_KIND = 'quickfix'
const SOURCE_FIX_ALL_TAILWIND_KIND = 'source.fixAll.tailwindcss'

function matchesRequestedKind(only: string[] | undefined, kind: string): boolean {
  if (!only?.length) return true

  return only.some((requestedKind) => {
    return requestedKind === kind || kind.startsWith(`${requestedKind}.`)
  })
}

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

  let shouldProvideQuickFixes = matchesRequestedKind(params.context.only, QUICK_FIX_KIND)
  let shouldProvideFixAll = matchesRequestedKind(params.context.only, SOURCE_FIX_ALL_TAILWIND_KIND)

  let diagnostics = shouldProvideQuickFixes
    ? await getDiagnosticsFromCodeActionParams(
        state,
        params,
        document,
        params.context.diagnostics
          .map((diagnostic) => diagnostic.code)
          .filter(Boolean) as DiagnosticKind[],
      )
    : []

  let quickFixCodeActions = shouldProvideQuickFixes
    ? await Promise.all(
        diagnostics.map((diagnostic) => {
          if (isInvalidApplyDiagnostic(diagnostic)) {
            return provideInvalidApplyCodeActions(state, document, diagnostic)
          }

          if (
            isInvalidConfigPathDiagnostic(diagnostic) ||
            isInvalidTailwindDirectiveDiagnostic(diagnostic) ||
            isInvalidScreenDiagnostic(diagnostic) ||
            isInvalidVariantDiagnostic(diagnostic) ||
            isDeprecatedAtRuleDiagnostic(diagnostic) ||
            isRecommendedVariantOrderDiagnostic(diagnostic) ||
            isSuggestCanonicalClasses(diagnostic)
          ) {
            return provideSuggestionCodeActions(state, params, diagnostic)
          }

          if (isCssConflictDiagnostic(diagnostic)) {
            return provideCssConflictCodeActions(state, params, diagnostic)
          }

          return []
        }),
      ).then(flatten)
    : []

  let shouldComputeFixAll =
    shouldProvideFixAll &&
    (params.context.only?.length
      ? true
      : params.context.diagnostics.some(
          (diagnostic) => diagnostic.code === DiagnosticKindEnum.SuggestCanonicalClasses,
        ))

  let fixAllCodeActions = shouldComputeFixAll
    ? await provideFixAllSuggestionCodeActions(state, document)
    : []

  let seen = new Set<string>()

  return [...quickFixCodeActions, ...fixAllCodeActions].filter((action) => {
    let fingerprint = JSON.stringify({
      kind: action.kind,
      edit: action.edit,
    })

    if (seen.has(fingerprint)) return false

    seen.add(fingerprint)
    return true
  })
}
