import type { State, Settings } from '../util/state'
import type { Range } from 'vscode-languageserver'
import type { TextDocument } from 'vscode-languageserver-textdocument'
import { type InvalidTailwindDirectiveDiagnostic, DiagnosticKind } from './types'
import { isCssDoc } from '../util/css'
import { getLanguageBoundaries } from '../util/getLanguageBoundaries'
import { findAll, indexToPosition } from '../util/find'
import * as semver from '../util/semver'
import { closest } from '../util/closest'
import { absoluteRange } from '../util/absoluteRange'
import { getTextWithoutComments } from '../util/doc'
import { isSemicolonlessCssLanguage } from '../util/languages'

export function getInvalidTailwindDirectiveDiagnostics(
  state: State,
  document: TextDocument,
  settings: Settings,
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

  let regex: RegExp
  if (isSemicolonlessCssLanguage(document.languageId, state.editor?.userLanguages)) {
    regex = /(?:\s|^)@tailwind\s+(?<value>[^\r\n]+)/g
  } else {
    regex = /(?:\s|^)@tailwind\s+(?<value>[^;]+)/g
  }

  ranges.forEach((range) => {
    let text = getTextWithoutComments(document, 'css', range)
    let matches = findAll(regex, text)

    matches.forEach((match) => {
      let layerName = match.groups.value

      let result = validateLayerName(state, layerName)
      if (!result) return

      let { message, suggestions } = result

      diagnostics.push({
        code: DiagnosticKind.InvalidTailwindDirective,
        source: 'tailwindcss',
        range: absoluteRange(
          {
            start: indexToPosition(text, match.index + match[0].length - layerName.length),
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

function validateLayerName(
  state: State,
  layerName: string,
): { message: string; suggestions: string[] } | null {
  if (state.v4) {
    // `@tailwind utilities` is valid
    if (layerName === 'utilities') {
      return null
    }

    // `@tailwind base | preflight` do not exist in v4
    if (layerName === 'base' || layerName === 'preflight') {
      return {
        message: `'@tailwind ${layerName}' is no longer available in v4. Use '@import "tailwindcss/preflight"' instead.`,
        suggestions: [],
      }
    }

    // `@tailwind components | screens | variants` do not exist in v4
    if (layerName === 'components' || layerName === 'screens' || layerName === 'variants') {
      return {
        message: `'@tailwind ${layerName}' is no longer available in v4. Use '@tailwind utilities' instead.`,
        suggestions: ['utilities'],
      }
    }

    let parts = layerName.split(/\s+/)

    // `@tailwind utilities source(…)` is valid
    if (parts[0] === 'utilities' && parts[1]?.startsWith('source(')) {
      return null
    }

    return {
      message: `'${layerName}' is not a valid value.`,
      suggestions: [],
    }
  }

  let valid = ['utilities', 'components', 'screens']

  if (semver.gte(state.version, '1.0.0-beta.1')) {
    valid.push('base')
  } else {
    valid.push('preflight')
  }

  let hasVariantsDirective = state.jit && semver.gte(state.version, '2.1.99')

  if (hasVariantsDirective) {
    valid.push('variants')
  }

  if (valid.includes(layerName)) {
    return null
  }

  let suggestable = valid

  if (hasVariantsDirective) {
    // Don't suggest `screens`, because it's deprecated
    suggestable = suggestable.filter((value) => value !== 'screens')
  }

  let message = `'${layerName}' is not a valid value.`
  let suggestions: string[] = []

  if (layerName === 'preflight') {
    suggestions.push('base')
    message += ` Did you mean 'base'?`
  } else {
    let suggestion = closest(layerName, suggestable)
    if (suggestion) {
      suggestions.push(suggestion)
      message += ` Did you mean '${suggestion}'?`
    }
  }

  return {
    message,
    suggestions,
  }
}
