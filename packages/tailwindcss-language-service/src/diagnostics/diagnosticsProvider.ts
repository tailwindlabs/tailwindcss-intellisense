import type { TextDocument } from 'vscode-languageserver'
import { State } from '../util/state'
import { DiagnosticKind, AugmentedDiagnostic } from './types'
import { getCssConflictDiagnostics } from './getCssConflictDiagnostics'
import { getInvalidApplyDiagnostics } from './getInvalidApplyDiagnostics'
import { getInvalidScreenDiagnostics } from './getInvalidScreenDiagnostics'
import { getInvalidVariantDiagnostics } from './getInvalidVariantDiagnostics'
import { getInvalidConfigPathDiagnostics } from './getInvalidConfigPathDiagnostics'
import { getInvalidTailwindDirectiveDiagnostics } from './getInvalidTailwindDirectiveDiagnostics'
import { getIncorrectVariantOrderDiagnostics } from './getIncorrectVariantOrderDiagnostics'

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
    DiagnosticKind.IncorrectVariantOrder,
  ]
): Promise<AugmentedDiagnostic[]> {
  const settings = await state.editor.getConfiguration(document.uri)

  return settings.tailwindCSS.validate
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
        ...(only.includes(DiagnosticKind.IncorrectVariantOrder)
          ? await getIncorrectVariantOrderDiagnostics(state, document, settings)
          : []),
      ]
    : []
}

export async function provideDiagnostics(state: State, document: TextDocument) {
  // state.editor.connection.sendDiagnostics({
  //   uri: document.uri,
  //   diagnostics: await doValidate(state, document),
  // })
}

export function clearDiagnostics(state: State, document: TextDocument): void {
  // state.editor.connection.sendDiagnostics({
  //   uri: document.uri,
  //   diagnostics: [],
  // })
}

export function clearAllDiagnostics(state: State): void {
  state.editor.documents.all().forEach((document) => {
    clearDiagnostics(state, document)
  })
}

export function updateAllDiagnostics(state: State): void {
  state.editor.documents.all().forEach((document) => {
    provideDiagnostics(state, document)
  })
}
