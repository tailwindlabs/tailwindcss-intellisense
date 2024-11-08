import type { State, Settings } from '../util/state'
import { Diagnostic, type Range } from 'vscode-languageserver'
import {
  type InvalidConfigPathDiagnostic,
  DiagnosticKind,
  InvalidSourceDirectiveDiagnostic,
} from './types'
import { findAll, findHelperFunctionsInDocument, indexToPosition } from '../util/find'
import { stringToPath } from '../util/stringToPath'
import isObject from '../util/isObject'
import { closest, distance } from '../util/closest'
import { combinations } from '../util/combinations'
import dlv from 'dlv'
import type { TextDocument } from 'vscode-languageserver-textdocument'
import type { DesignSystem } from '../util/v4'
import { getLanguageBoundaries } from '../util/getLanguageBoundaries'
import { isCssDoc } from '../util/css'
import { getCssBlocks } from '../util/language-blocks'
import { isSemicolonlessCssLanguage } from '../util/languages'
import { absoluteRange } from '../util/absoluteRange'

// @import … source('…')
// @tailwind utilities source('…')
const PATTERN_IMPORT_SOURCE =
  /(?:\s|^)@(?<directive>import)\s*(?<path>'[^']*'|"[^"]*")\s*source\((?<source>'[^']*'?|"[^"]*"?|[a-z]*|\)|;)/dg
const PATTERN_UTIL_SOURCE =
  /(?:\s|^)@(?<directive>tailwind)\s+(?<layer>\S+)\s+source\((?<source>'[^']*'?|"[^"]*"?|[a-z]*|\)|;)/dg

// @source …
const PATTERN_AT_SOURCE =
  /(?:\s|^)@(?<directive>source)\s*(?<source>'[^']*'?|"[^"]*"?|[a-z]*|\)|;)/dg

const HAS_DRIVE_LETTER = /^[A-Z]:/

export function getInvalidSourceDiagnostics(
  state: State,
  document: TextDocument,
  settings: Settings,
): InvalidSourceDirectiveDiagnostic[] {
  let severity = settings.tailwindCSS.lint.invalidSourceDirective
  if (severity === 'ignore') return []

  let diagnostics: InvalidSourceDirectiveDiagnostic[] = []

  function add(diag: Omit<InvalidSourceDirectiveDiagnostic, 'code' | 'severity'>) {
    diagnostics.push({
      code: DiagnosticKind.InvalidSourceDirective,
      severity:
        severity === 'error'
          ? 1 /* DiagnosticSeverity.Error */
          : 2 /* DiagnosticSeverity.Warning */,
      ...diag,
    })
  }

  for (let block of getCssBlocks(state, document)) {
    let text = block.text

    let matches = [
      ...findAll(PATTERN_IMPORT_SOURCE, text),
      ...findAll(PATTERN_UTIL_SOURCE, text),
      ...findAll(PATTERN_AT_SOURCE, text),
    ]

    for (let match of matches) {
      let directive = match.groups.directive
      let source = match.groups.source?.trim() ?? ''
      let rawSource = source
      let sourceRange = match.indices.groups.source
      let isQuoted = false

      if (source.startsWith("'")) {
        source = source.slice(1)
        isQuoted = true
      } else if (source.startsWith('"')) {
        source = source.slice(1)
        isQuoted = true
      }

      if (source.endsWith("'")) {
        source = source.slice(0, -1)
        isQuoted = true
      } else if (source.endsWith('"')) {
        source = source.slice(0, -1)
        isQuoted = true
      }

      source = source.trim()

      // - `@import "tailwindcss" source()`
      // - `@import "tailwindcss" source('')`
      // - `@import "tailwindcss" source("")`

      // - `@source ;`
      // - `@source '';`
      // - `@source "";`
      if (source === '' || source === ')' || source === ';') {
        let range = {
          start: indexToPosition(text, sourceRange[0]),
          end: indexToPosition(text, sourceRange[1]),
        }

        add({
          message: 'Need a path for the source directive',
          range: absoluteRange(range, block.range),
        })
      }

      // - `@import "tailwindcss" source(no)`
      // - `@tailwind utilities source('')`
      else if (directive !== 'source' && source !== 'none' && !isQuoted) {
        let range = {
          start: indexToPosition(text, sourceRange[0]),
          end: indexToPosition(text, sourceRange[1]),
        }

        add({
          message: `\`source(${source})\` is invalid. Did you mean \`source(none)\`.`,
          range: absoluteRange(range, block.range),
        })
      }

      // Detection of Windows-style paths
      else if (source.includes('\\\\') || HAS_DRIVE_LETTER.test(source)) {
        source = source.replaceAll('\\\\', '\\')

        let range = {
          start: indexToPosition(text, sourceRange[0]),
          end: indexToPosition(text, sourceRange[1]),
        }

        add({
          message: `POSIX-style paths are required with source() but \`${source}\` is a Windows-style path.`,
          range: absoluteRange(range, block.range),
        })
      }

      // Detection of globs in non-`@source` directives
      else if (
        directive !== 'source' &&
        (source.includes('*') || source.includes('{') || source.includes('}'))
      ) {
        let range = {
          start: indexToPosition(text, sourceRange[0]),
          end: indexToPosition(text, sourceRange[1]),
        }

        add({
          message: `source(${rawSource}) uses a glob but a glob cannot be used here. Use a directory name instead.`,
          range: absoluteRange(range, block.range),
        })
      }

      // `@source none` is invalid
      else if (directive === 'source' && source === 'none') {
        let range = {
          start: indexToPosition(text, sourceRange[0]),
          end: indexToPosition(text, sourceRange[1]),
        }

        add({
          message:
            '`@source none;` is not valid. Did you mean to use `source(none)` on an `@import`?',
          range: absoluteRange(range, block.range),
        })
      }

      // - `@import "tailwindcss" source(no)`
      // - `@tailwind utilities source('')`
      else if (directive === 'source' && source !== 'none' && !isQuoted) {
        let range = {
          start: indexToPosition(text, sourceRange[0]),
          end: indexToPosition(text, sourceRange[1]),
        }

        add({
          message: `\`@source ${rawSource};\` is invalid.`,
          range: absoluteRange(range, block.range),
        })
      }
    }
  }

  return diagnostics
}
