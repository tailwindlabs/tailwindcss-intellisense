import { State, Settings } from '../util/state'
import type { TextDocument, Range, DiagnosticSeverity } from 'vscode-languageserver'
import { InvalidVariantDiagnostic, DiagnosticKind } from './types'
import { isCssDoc } from '../util/css'
import { getLanguageBoundaries } from '../util/getLanguageBoundaries'
import { findAll, indexToPosition } from '../util/find'
import { closest } from '../util/closest'
import { absoluteRange } from '../util/absoluteRange'
import dlv from 'dlv'

export function getInvalidVariantDiagnostics(
  state: State,
  document: TextDocument,
  settings: Settings
): InvalidVariantDiagnostic[] {
  let severity = settings.tailwindCSS.lint.invalidVariant
  if (severity === 'ignore') return []

  let diagnostics: InvalidVariantDiagnostic[] = []
  let ranges: Range[] = []

  if (isCssDoc(state, document)) {
    ranges.push(undefined)
  } else {
    let boundaries = getLanguageBoundaries(state, document)
    if (!boundaries) return []
    ranges.push(...boundaries.css)
  }

  let possibleVariants = Object.keys(state.variants)
  if (state.jit) {
    possibleVariants.unshift('responsive')
    possibleVariants = possibleVariants.filter((v) => !state.screens.includes(v))
  }

  ranges.forEach((range) => {
    let text = document.getText(range)
    let matches = findAll(/(?:\s|^)@variants\s+(?<variants>[^{]+)/g, text)

    matches.forEach((match) => {
      let variants = match.groups.variants.split(/(\s*,\s*)/)
      let listStartIndex = match.index + match[0].length - match.groups.variants.length

      for (let i = 0; i < variants.length; i += 2) {
        let variant = variants[i].trim()
        if (possibleVariants.includes(variant)) {
          continue
        }

        let message = `The variant '${variant}' does not exist.`
        let suggestions: string[] = []
        let suggestion = closest(variant, possibleVariants)

        if (suggestion) {
          suggestions.push(suggestion)
          message += ` Did you mean '${suggestion}'?`
        }

        let variantStartIndex = listStartIndex + variants.slice(0, i).join('').length

        diagnostics.push({
          code: DiagnosticKind.InvalidVariant,
          range: absoluteRange(
            {
              start: indexToPosition(text, variantStartIndex),
              end: indexToPosition(text, variantStartIndex + variant.length),
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
      }
    })
  })

  return diagnostics
}
