import type { TextDocument } from 'vscode-languageserver-textdocument'
import { State } from '../util/state'
import { DiagnosticKind, AugmentedDiagnostic } from './types'
import { getCssConflictDiagnostics } from './getCssConflictDiagnostics'
import { getInvalidApplyDiagnostics } from './getInvalidApplyDiagnostics'
import { getInvalidScreenDiagnostics } from './getInvalidScreenDiagnostics'
import { getInvalidVariantDiagnostics } from './getInvalidVariantDiagnostics'
import { getInvalidConfigPathDiagnostics } from './getInvalidConfigPathDiagnostics'
import { getInvalidTailwindDirectiveDiagnostics } from './getInvalidTailwindDirectiveDiagnostics'
import { getRecommendedVariantOrderDiagnostics } from './getRecommendedVariantOrderDiagnostics'
import { getInvalidValueDiagnostics } from './getInvalidValueDiagnostics'

export async function doValidate(
  state: State,
  document: TextDocument,
  only: DiagnosticKind[] = [
    DiagnosticKind.CssConflict,
    DiagnosticKind.InvalidApply,
    DiagnosticKind.InvalidScreen,
    DiagnosticKind.InvalidVariant,
    DiagnosticKind.InvalidConfigPath,
	DiagnosticKind.InvalidIdentifier,
    DiagnosticKind.InvalidTailwindDirective,
    DiagnosticKind.RecommendedVariantOrder,
  ]
): Promise<AugmentedDiagnostic[]> {
  const settings = await state.editor.getConfiguration(document.uri)

  return settings.tailwindCSS.validate
    ? [
        ...(only.includes(DiagnosticKind.InvalidIdentifier)
          ? await getInvalidValueDiagnostics(state, document, settings)
          : []),
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
        ...(only.includes(DiagnosticKind.RecommendedVariantOrder)
          ? await getRecommendedVariantOrderDiagnostics(state, document, settings)
          : []),
      ]
    : []
}
