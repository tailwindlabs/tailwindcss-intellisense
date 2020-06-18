import { Diagnostic } from 'vscode-languageserver'
import { DocumentClassName, DocumentClassList } from '../../util/state'

export enum DiagnosticKind {
  UtilityConflicts = 'utilityConflicts',
  InvalidApply = 'invalidApply',
  InvalidScreen = 'invalidScreen',
  InvalidVariant = 'invalidVariant',
  InvalidConfigPath = 'invalidConfigPath',
  InvalidTailwindDirective = 'invalidTailwindDirective',
}

export type UtilityConflictsDiagnostic = Diagnostic & {
  code: DiagnosticKind.UtilityConflicts
  className: DocumentClassName
  otherClassNames: DocumentClassName[]
}

export function isUtilityConflictsDiagnostic(
  diagnostic: AugmentedDiagnostic
): diagnostic is UtilityConflictsDiagnostic {
  return diagnostic.code === DiagnosticKind.UtilityConflicts
}

export type InvalidApplyDiagnostic = Diagnostic & {
  code: DiagnosticKind.InvalidApply
  className: DocumentClassName
}

export function isInvalidApplyDiagnostic(
  diagnostic: AugmentedDiagnostic
): diagnostic is InvalidApplyDiagnostic {
  return diagnostic.code === DiagnosticKind.InvalidApply
}

export type InvalidScreenDiagnostic = Diagnostic & {
  code: DiagnosticKind.InvalidScreen
}

export function isInvalidScreenDiagnostic(
  diagnostic: AugmentedDiagnostic
): diagnostic is InvalidScreenDiagnostic {
  return diagnostic.code === DiagnosticKind.InvalidScreen
}

export type InvalidVariantDiagnostic = Diagnostic & {
  code: DiagnosticKind.InvalidVariant
}

export function isInvalidVariantDiagnostic(
  diagnostic: AugmentedDiagnostic
): diagnostic is InvalidVariantDiagnostic {
  return diagnostic.code === DiagnosticKind.InvalidVariant
}

export type InvalidConfigPathDiagnostic = Diagnostic & {
  code: DiagnosticKind.InvalidConfigPath
}

export function isInvalidConfigPathDiagnostic(
  diagnostic: AugmentedDiagnostic
): diagnostic is InvalidConfigPathDiagnostic {
  return diagnostic.code === DiagnosticKind.InvalidConfigPath
}

export type InvalidTailwindDirectiveDiagnostic = Diagnostic & {
  code: DiagnosticKind.InvalidTailwindDirective
}

export function isInvalidTailwindDirectiveDiagnostic(
  diagnostic: AugmentedDiagnostic
): diagnostic is InvalidTailwindDirectiveDiagnostic {
  return diagnostic.code === DiagnosticKind.InvalidTailwindDirective
}

export type AugmentedDiagnostic =
  | UtilityConflictsDiagnostic
  | InvalidApplyDiagnostic
  | InvalidScreenDiagnostic
  | InvalidVariantDiagnostic
  | InvalidConfigPathDiagnostic
  | InvalidTailwindDirectiveDiagnostic
