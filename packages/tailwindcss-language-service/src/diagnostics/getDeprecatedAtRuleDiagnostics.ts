import type { State, Settings } from '../util/state'
import { DiagnosticTag, type Range } from 'vscode-languageserver'
import type { TextDocument } from 'vscode-languageserver-textdocument'
import { DiagnosticKind, type DeprecatedAtRuleDiagnostic } from './types'
import { absoluteRange } from '../util/absoluteRange'
import { isCssDoc } from '../util/css'
import { getTextWithoutComments } from '../util/doc'
import { findAll, indexToPosition } from '../util/find'
import { getLanguageBoundaries } from '../util/getLanguageBoundaries'

export function getDeprecatedAtRuleDiagnostics(
  state: State,
  document: TextDocument,
  settings: Settings,
): DeprecatedAtRuleDiagnostic[] {
  if (!state.v4) return []

  let severity = settings.tailwindCSS.lint.deprecatedAtRule
  if (severity === 'ignore') return []

  let diagnostics: DeprecatedAtRuleDiagnostic[] = []

  let ranges: Range[] = []

  if (isCssDoc(state, document)) {
    ranges.push(undefined)
  } else {
    let boundaries = getLanguageBoundaries(state, document)
    if (!boundaries) return []
    ranges.push(...boundaries.filter((b) => b.type === 'css').map(({ range }) => range))
  }

  ranges.forEach((range) => {
    let text = getTextWithoutComments(document, 'css', range)
    let matches = findAll(/(?:\s|^)@variant\s+[-_a-zA-Z0-9]+\s+\([^;{}]+\)\s*;/g, text)

    matches.forEach((match) => {
      let variantStartIndex = match.index + match[0].indexOf('@variant')

      diagnostics.push({
        code: DiagnosticKind.DeprecatedAtRule,
        source: 'tailwindcss',
        range: absoluteRange(
          {
            start: indexToPosition(text, variantStartIndex),
            end: indexToPosition(text, variantStartIndex + '@variant'.length),
          },
          range,
        ),
        severity:
          severity === 'error'
            ? 1 /* DiagnosticSeverity.Error */
            : 2 /* DiagnosticSeverity.Warning */,
        message:
          '`@variant` is deprecated for defining custom variants. Use `@custom-variant` instead.',
        suggestions: ['@custom-variant'],
        ...(state.editor.capabilities.diagnosticTagSupport
          ? { tags: [DiagnosticTag.Deprecated] }
          : {}),
      })
    })
  })

  return diagnostics
}
