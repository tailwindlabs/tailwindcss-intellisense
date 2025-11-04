import type { State, Settings } from '../util/state'
import type { Range } from 'vscode-languageserver'
import type { TextDocument } from 'vscode-languageserver-textdocument'
import { type InvalidScreenDiagnostic, DiagnosticKind } from './types'
import { isCssDoc } from '../util/css'
import { getLanguageBoundaries } from '../util/getLanguageBoundaries'
import { findAll, indexToPosition } from '../util/find'
import { closest } from '../util/closest'
import { absoluteRange } from '../util/absoluteRange'
import { getTextWithoutComments } from '../util/doc'

export function getInvalidScreenDiagnostics(
  state: State,
  document: TextDocument,
  settings: Settings,
): InvalidScreenDiagnostic[] {
  let severity = settings.tailwindCSS.lint.invalidScreen
  if (severity === 'ignore') return []

  let diagnostics: InvalidScreenDiagnostic[] = []
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
    let matches = findAll(/(?:\s|^)@screen\s+(?<screen>[^\s{]+)/g, text)

    matches.forEach((match) => {
      if (state.screens.includes(match.groups.screen)) {
        return null
      }

      let message = `The screen '${match.groups.screen}' does not exist in your theme config.`
      let suggestions: string[] = []
      let suggestion = closest(match.groups.screen, state.screens)

      if (suggestion) {
        suggestions.push(suggestion)
        message += ` Did you mean '${suggestion}'?`
      }

      diagnostics.push({
        code: DiagnosticKind.InvalidScreen,
        source: 'tailwindcss',
        range: absoluteRange(
          {
            start: indexToPosition(
              text,
              match.index + match[0].length - match.groups.screen.length,
            ),
            end: indexToPosition(text, match.index + match[0].length),
          },
          range,
        ),
        severity:
          severity === 'error'
            ? 1 /* DiagnosticSeverity.Error */
            : 2 /* DiagnosticSeverity.Warning */,
        message,
        suggestions,
      })
    })
  })

  return diagnostics
}
