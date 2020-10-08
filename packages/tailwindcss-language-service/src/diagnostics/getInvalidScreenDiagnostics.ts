import { State, Settings } from '../util/state'
import type { TextDocument, Range, DiagnosticSeverity } from 'vscode-languageserver'
import { InvalidScreenDiagnostic, DiagnosticKind } from './types'
import { isCssDoc } from '../util/css'
import { getLanguageBoundaries } from '../util/getLanguageBoundaries'
import { findAll, indexToPosition } from '../util/find'
import { closest } from '../util/closest'
import { absoluteRange } from '../util/absoluteRange'
const dlv = require('dlv')

export function getInvalidScreenDiagnostics(
  state: State,
  document: TextDocument,
  settings: Settings
): InvalidScreenDiagnostic[] {
  let severity = settings.lint.invalidScreen
  if (severity === 'ignore') return []

  let diagnostics: InvalidScreenDiagnostic[] = []
  let ranges: Range[] = []

  if (isCssDoc(state, document)) {
    ranges.push(undefined)
  } else {
    let boundaries = getLanguageBoundaries(state, document)
    if (!boundaries) return []
    ranges.push(...boundaries.css)
  }

  ranges.forEach((range) => {
    let text = document.getText(range)
    let matches = findAll(/(?:\s|^)@screen\s+(?<screen>[^\s{]+)/g, text)

    let screens = Object.keys(
      dlv(state.config, 'theme.screens', dlv(state.config, 'screens', {}))
    )

    matches.forEach((match) => {
      if (screens.includes(match.groups.screen)) {
        return null
      }

      let message = `The screen '${match.groups.screen}' does not exist in your theme config.`
      let suggestions: string[] = []
      let suggestion = closest(match.groups.screen, screens)

      if (suggestion) {
        suggestions.push(suggestion)
        message += ` Did you mean '${suggestion}'?`
      }

      diagnostics.push({
        code: DiagnosticKind.InvalidScreen,
        range: absoluteRange(
          {
            start: indexToPosition(
              text,
              match.index + match[0].length - match.groups.screen.length
            ),
            end: indexToPosition(text, match.index + match[0].length),
          },
          range
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
