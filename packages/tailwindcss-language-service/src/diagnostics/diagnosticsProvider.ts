import type { TextDocument } from 'vscode-languageserver'
import { State } from '../util/state'
import { getDocumentSettings } from '../util/getDocumentSettings'
import { DiagnosticKind, AugmentedDiagnostic } from './types'
import { getCssConflictDiagnostics } from './getCssConflictDiagnostics'
import { getInvalidApplyDiagnostics } from './getInvalidApplyDiagnostics'
import { getInvalidScreenDiagnostics } from './getInvalidScreenDiagnostics'
import { getInvalidVariantDiagnostics } from './getInvalidVariantDiagnostics'
import { getInvalidConfigPathDiagnostics } from './getInvalidConfigPathDiagnostics'
import { getInvalidTailwindDirectiveDiagnostics } from './getInvalidTailwindDirectiveDiagnostics'

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
  ]
): Promise<AugmentedDiagnostic[]> {
  const settings = await getDocumentSettings(state, document)

  return settings.validate
    ? [
        ...(only.includes(DiagnosticKind.CssConflict)
          ? getCssConflictDiagnostics(state, document, settings)
          : []),
        ...(only.includes(DiagnosticKind.InvalidApply)
          ? getInvalidApplyDiagnostics(state, document, settings)
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
      ]
    : []
}

export async function provideDiagnostics(state: State, document: TextDocument) {
  state.editor.connection.sendDiagnostics({
    uri: document.uri,
    diagnostics: await doValidate(state, document),
  })
}

export function clearDiagnostics(state: State, document: TextDocument): void {
  state.editor.connection.sendDiagnostics({
    uri: document.uri,
    diagnostics: [],
  })
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
