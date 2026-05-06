import type { TextDocument } from 'vscode-languageserver-textdocument'
import type { FullDocumentDiagnosticReport } from 'vscode-languageserver'
import type { State } from '../util/state'
import { DiagnosticKind, type AugmentedDiagnostic } from './types'
import { getCssConflictDiagnostics } from './getCssConflictDiagnostics'
import { getInvalidApplyDiagnostics } from './getInvalidApplyDiagnostics'
import { getInvalidScreenDiagnostics } from './getInvalidScreenDiagnostics'
import { getInvalidVariantDiagnostics } from './getInvalidVariantDiagnostics'
import { getInvalidConfigPathDiagnostics } from './getInvalidConfigPathDiagnostics'
import { getInvalidTailwindDirectiveDiagnostics } from './getInvalidTailwindDirectiveDiagnostics'
import { getRecommendedVariantOrderDiagnostics } from './getRecommendedVariantOrderDiagnostics'
import { getInvalidSourceDiagnostics } from './getInvalidSourceDiagnostics'
import { getUsedBlocklistedClassDiagnostics } from './getUsedBlocklistedClassDiagnostics'
import { getSuggestCanonicalClassesDiagnostics } from './canonical-classes'

/**
 * This is exported because it was previously exported and may be in use by
 * external, third-party clients. Do not use.
 *
 * TODO: Remove in v0.16.0
 *
 * @deprecated Use `getDocumentDiagnostics` instead
 */
export async function doValidate(
  state: State,
  document: TextDocument,
  only: DiagnosticKind[] = [
    DiagnosticKind.CssConflict,
    DiagnosticKind.InvalidApply,
    DiagnosticKind.InvalidScreen,
    DiagnosticKind.InvalidVariant,
    DiagnosticKind.InvalidConfigPath,
    DiagnosticKind.InvalidTailwindDirective,
    DiagnosticKind.InvalidSourceDirective,
    DiagnosticKind.RecommendedVariantOrder,
    DiagnosticKind.UsedBlocklistedClass,
    DiagnosticKind.SuggestCanonicalClasses,
  ],
): Promise<AugmentedDiagnostic[]> {
  let report = await getDocumentDiagnostics(state, document, only)
  return report.items as AugmentedDiagnostic[]
}

export async function getDocumentDiagnostics(
  state: State,
  document: TextDocument,
  only: DiagnosticKind[] = [
    DiagnosticKind.CssConflict,
    DiagnosticKind.InvalidApply,
    DiagnosticKind.InvalidScreen,
    DiagnosticKind.InvalidVariant,
    DiagnosticKind.InvalidConfigPath,
    DiagnosticKind.InvalidTailwindDirective,
    DiagnosticKind.InvalidSourceDirective,
    DiagnosticKind.RecommendedVariantOrder,
    DiagnosticKind.UsedBlocklistedClass,
    DiagnosticKind.SuggestCanonicalClasses,
  ],
): Promise<FullDocumentDiagnosticReport> {
  const settings = await state.editor.getConfiguration(document.uri)

  let items = settings.tailwindCSS.validate
    ? [
        ...(only.includes(DiagnosticKind.CssConflict)
          ? await getCssConflictDiagnostics(state, document, settings)
          : []),
        ...(only.includes(DiagnosticKind.InvalidApply)
          ? await getInvalidApplyDiagnostics(state, document, settings)
          : []),
        ...(only.includes(DiagnosticKind.InvalidScreen)
          ? getInvalidScreenDiagnostics(state, document, settings)
          : []),
        ...(only.includes(DiagnosticKind.InvalidVariant)
          ? getInvalidVariantDiagnostics(state, document, settings)
          : []),
        ...(only.includes(DiagnosticKind.InvalidConfigPath)
          ? getInvalidConfigPathDiagnostics(state, document, settings)
          : []),
        ...(only.includes(DiagnosticKind.InvalidTailwindDirective)
          ? getInvalidTailwindDirectiveDiagnostics(state, document, settings)
          : []),
        ...(only.includes(DiagnosticKind.InvalidSourceDirective)
          ? getInvalidSourceDiagnostics(state, document, settings)
          : []),
        ...(only.includes(DiagnosticKind.RecommendedVariantOrder)
          ? await getRecommendedVariantOrderDiagnostics(state, document, settings)
          : []),
        ...(only.includes(DiagnosticKind.UsedBlocklistedClass)
          ? await getUsedBlocklistedClassDiagnostics(state, document, settings)
          : []),
        ...(only.includes(DiagnosticKind.SuggestCanonicalClasses)
          ? await getSuggestCanonicalClassesDiagnostics(state, document, settings)
          : []),
      ]
    : []

  return {
    kind: 'full',
    items,
  }
}
