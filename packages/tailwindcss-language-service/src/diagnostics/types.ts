import type { Diagnostic } from 'vscode-languageserver'
import type { DocumentClassName } from '../util/state'

export enum DiagnosticKind {
  CssConflict = 'cssConflict',
  InvalidApply = 'invalidApply',
  InvalidScreen = 'invalidScreen',
  InvalidVariant = 'invalidVariant',
  InvalidConfigPath = 'invalidConfigPath',
  InvalidTailwindDirective = 'invalidTailwindDirective',
  InvalidSourceDirective = 'invalidSourceDirective',
  RecommendedVariantOrder = 'recommendedVariantOrder',
  UsedBlocklistedClass = 'usedBlocklistedClass',
}

export type CssConflictDiagnostic = Diagnostic & {
  code: DiagnosticKind.CssConflict
  className: DocumentClassName
  otherClassNames: DocumentClassName[]
}

export function isCssConflictDiagnostic(
  diagnostic: AugmentedDiagnostic,
): diagnostic is CssConflictDiagnostic {
  return diagnostic.code === DiagnosticKind.CssConflict
}

export type InvalidApplyDiagnostic = Diagnostic & {
  code: DiagnosticKind.InvalidApply
  className: DocumentClassName
}

export function isInvalidApplyDiagnostic(
  diagnostic: AugmentedDiagnostic,
): diagnostic is InvalidApplyDiagnostic {
  return diagnostic.code === DiagnosticKind.InvalidApply
}

export type InvalidScreenDiagnostic = Diagnostic & {
  code: DiagnosticKind.InvalidScreen
  suggestions: string[]
}

export function isInvalidScreenDiagnostic(
  diagnostic: AugmentedDiagnostic,
): diagnostic is InvalidScreenDiagnostic {
  return diagnostic.code === DiagnosticKind.InvalidScreen
}

export type InvalidVariantDiagnostic = Diagnostic & {
  code: DiagnosticKind.InvalidVariant
  suggestions: string[]
}

export function isInvalidVariantDiagnostic(
  diagnostic: AugmentedDiagnostic,
): diagnostic is InvalidVariantDiagnostic {
  return diagnostic.code === DiagnosticKind.InvalidVariant
}

export type InvalidConfigPathDiagnostic = Diagnostic & {
  code: DiagnosticKind.InvalidConfigPath
  suggestions: string[]
}

export function isInvalidConfigPathDiagnostic(
  diagnostic: AugmentedDiagnostic,
): diagnostic is InvalidConfigPathDiagnostic {
  return diagnostic.code === DiagnosticKind.InvalidConfigPath
}

export type InvalidTailwindDirectiveDiagnostic = Diagnostic & {
  code: DiagnosticKind.InvalidTailwindDirective
  suggestions: string[]
}

export function isInvalidTailwindDirectiveDiagnostic(
  diagnostic: AugmentedDiagnostic,
): diagnostic is InvalidTailwindDirectiveDiagnostic {
  return diagnostic.code === DiagnosticKind.InvalidTailwindDirective
}

export type InvalidSourceDirectiveDiagnostic = Diagnostic & {
  code: DiagnosticKind.InvalidSourceDirective
}

export function isInvalidSourceDirectiveDiagnostic(
  diagnostic: AugmentedDiagnostic,
): diagnostic is InvalidSourceDirectiveDiagnostic {
  return diagnostic.code === DiagnosticKind.InvalidSourceDirective
}

export type RecommendedVariantOrderDiagnostic = Diagnostic & {
  code: DiagnosticKind.RecommendedVariantOrder
  suggestions: string[]
}

export function isRecommendedVariantOrderDiagnostic(
  diagnostic: AugmentedDiagnostic,
): diagnostic is RecommendedVariantOrderDiagnostic {
  return diagnostic.code === DiagnosticKind.RecommendedVariantOrder
}

export type UsedBlocklistedClassDiagnostic = Diagnostic & {
  code: DiagnosticKind.UsedBlocklistedClass
}

export function isUsedBlocklistedClass(
  diagnostic: AugmentedDiagnostic,
): diagnostic is UsedBlocklistedClassDiagnostic {
  return diagnostic.code === DiagnosticKind.UsedBlocklistedClass
}

export type AugmentedDiagnostic =
  | CssConflictDiagnostic
  | InvalidApplyDiagnostic
  | InvalidScreenDiagnostic
  | InvalidVariantDiagnostic
  | InvalidConfigPathDiagnostic
  | InvalidTailwindDirectiveDiagnostic
  | InvalidSourceDirectiveDiagnostic
  | RecommendedVariantOrderDiagnostic
  | UsedBlocklistedClassDiagnostic
