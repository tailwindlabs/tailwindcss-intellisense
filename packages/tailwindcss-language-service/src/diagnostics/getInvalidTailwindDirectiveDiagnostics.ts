import { State, Settings } from '../util/state'
import type { TextDocument, Range, DiagnosticSeverity } from 'vscode-languageserver'
import { InvalidTailwindDirectiveDiagnostic, DiagnosticKind } from './types'
import { isCssDoc } from '../util/css'
import { getLanguageBoundaries } from '../util/getLanguageBoundaries'
import { findAll, indexToPosition } from '../util/find'
import * as semver from '../util/semver'
import { closest } from '../util/closest'
import { absoluteRange } from '../util/absoluteRange'

export function getInvalidTailwindDirectiveDiagnostics(
  state: State,
  document: TextDocument,
  settings: Settings
): InvalidTailwindDirectiveDiagnostic[] {
  let severity = settings.tailwindCSS.lint.invalidTailwindDirective
  if (severity === 'ignore') return []

  let diagnostics: InvalidTailwindDirectiveDiagnostic[] = []
  let ranges: Range[] = []

  if (isCssDoc(state, document)) {
    ranges.push(undefined)
  } else {
    let boundaries = getLanguageBoundaries(state, document)
    if (!boundaries) return []
    ranges.push(...boundaries.filter((b) => b.type === 'css').map(({ range }) => range))
  }

  let notSemicolonLanguages = ['sass', 'sugarss', 'stylus']
  let regex: RegExp
  if (
    notSemicolonLanguages.includes(document.languageId) ||
    (state.editor &&
      notSemicolonLanguages.includes(state.editor.userLanguages[document.languageId]))
  ) {
    regex = /(?:\s|^)@tailwind\s+(?<value>[^\n]+)/g
  } else {
    regex = /(?:\s|^)@tailwind\s+(?<value>[^;]+)/g
  }

  let hasVariantsDirective = state.jit && semver.gte(state.version, '2.1.99')

  ranges.forEach((range) => {
    let text = document.getText(range)
    let matches = findAll(regex, text)

    let valid = [
      'utilities',
      'components',
      'screens',
      semver.gte(state.version, '1.0.0-beta.1') ? 'base' : 'preflight',
      hasVariantsDirective && 'variants',
    ].filter(Boolean)

    let suggestable = valid

    if (hasVariantsDirective) {
      // Don't suggest `screens`, because it's deprecated
      suggestable = suggestable.filter((value) => value !== 'screens')
    }

    matches.forEach((match) => {
      if (valid.includes(match.groups.value)) {
        return null
      }

      let message = `'${match.groups.value}' is not a valid value.`
      let suggestions: string[] = []

      if (match.groups.value === 'preflight') {
        suggestions.push('base')
        message += ` Did you mean 'base'?`
      } else {
        let suggestion = closest(match.groups.value, suggestable)
        if (suggestion) {
          suggestions.push(suggestion)
          message += ` Did you mean '${suggestion}'?`
        }
      }

      diagnostics.push({
        code: DiagnosticKind.InvalidTailwindDirective,
        range: absoluteRange(
          {
            start: indexToPosition(text, match.index + match[0].length - match.groups.value.length),
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
