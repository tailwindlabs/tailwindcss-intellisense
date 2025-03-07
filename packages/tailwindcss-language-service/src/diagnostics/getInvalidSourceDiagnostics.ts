import type { State, Settings } from '../util/state'
import { DiagnosticKind, InvalidSourceDirectiveDiagnostic } from './types'
import { findAll, indexToPosition } from '../util/find'
import type { TextDocument } from 'vscode-languageserver-textdocument'
import { getCssBlocks } from '../util/language-blocks'
import { absoluteRange } from '../util/absoluteRange'

// @import … source('…')
// @tailwind utilities source('…')
const PATTERN_IMPORT_SOURCE =
  /(?:\s|^)@(?<directive>(?:import|reference))\s*(?<path>'[^']*'|"[^"]*")\s*(layer\([^)]+\)\s*)?source\((?<source>'[^']*'?|"[^"]*"?|[a-z]*|\)|;)/dg
const PATTERN_UTIL_SOURCE =
  /(?:\s|^)@(?<directive>tailwind)\s+(?<layer>\S+)\s+source\((?<source>'[^']*'?|"[^"]*"?|[a-z]*|\)|;)/dg

// @source …
const PATTERN_AT_SOURCE =
  /(?:\s|^)@(?<directive>source)\s*(?<not>not)?\s*(?<source>'[^']*'?|"[^"]*"?|[a-z]*(?:\([^)]+\))?|\)|;)/dg

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
          message: 'The source directive requires a path to a directory.',
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
          message: `\`source(${source})\` is invalid. Did you mean \`source(none)\`?`,
          range: absoluteRange(range, block.range),
        })
      }

      // Detection of Windows-style paths
      else if (source.includes('\\') || HAS_DRIVE_LETTER.test(source)) {
        source = source.replaceAll('\\\\', '\\')

        let range = {
          start: indexToPosition(text, sourceRange[0]),
          end: indexToPosition(text, sourceRange[1]),
        }

        add({
          message: `POSIX-style paths are required with \`source(…)\` but \`${source}\` is a Windows-style path.`,
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

      // `@source inline(…)` is fine
      else if (directive === 'source' && source.startsWith('inline(')) {
        //
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
