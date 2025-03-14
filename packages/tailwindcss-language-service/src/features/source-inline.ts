/**
 * Support for `@source inline(…)`
 */

import type { Range, TextDocument } from 'vscode-languageserver-textdocument'
import type { State } from '../util/state'
import type { CodeLens } from 'vscode-languageserver'
import braces from 'braces'
import { findAll, indexToPosition } from '../util/find'
import { absoluteRange } from '../util/absoluteRange'
import { segment } from '../util/segment'

const PATTERN = /@source(?:\s+not)?\s*inline\((?<glob>'[^']+'|"[^"]+")/dg

export async function provideCodeLens(state: State, doc: TextDocument): Promise<CodeLens[]> {
  let text = doc.getText()

  let countFormatter = new Intl.NumberFormat('en', {
    maximumFractionDigits: 2,
  })

  let lenses: CodeLens[] = []

  for (let match of findAll(PATTERN, text)) {
    let glob = match.groups.glob.slice(1, -1)

    // Perform brace expansion
    let expanded = new Set<string>(braces.expand(glob))
    if (expanded.size < 2) continue

    let slice: Range = absoluteRange({
      start: indexToPosition(text, match.indices.groups.glob[0]),
      end: indexToPosition(text, match.indices.groups.glob[1]),
    })

    let size = 0
    for (let className of expanded) {
      size += approximateByteSize(className)
    }

    lenses.push({
      range: slice,
      command: {
        title: `Generates ${countFormatter.format(expanded.size)} classes`,
        command: '',
      },
    })

    if (size >= 1_000_000) {
      lenses.push({
        range: slice,
        command: {
          title: `At least ${formatBytes(size)} of CSS`,
          command: '',
        },
      })

      lenses.push({
        range: slice,
        command: {
          title: `This may slow down your bundler/browser`,
          command: '',
        },
      })
    }
  }

  return lenses
}

/**
 * Calculates the approximate size of a generated class
 *
 * This is meant to be a lower bound, as the actual size of a class can vary
 * depending on the actual CSS properties and values, configured theme, etc…
 */
function approximateByteSize(className: string) {
  let size = 0

  // We estimate the size using the following structure which gives a reasonable
  // lower bound on the size of the generated CSS:
  //
  // .class-name {
  //   &:variant-1 {
  //     &:variant-2 {
  //       …
  //     }
  //   }
  // }

  // Class name
  size += 1 + className.length + 3
  size += 2

  // Variants + nesting
  for (let [depth, variantName] of segment(className, ':').entries()) {
    size += (depth + 1) * 2 + 2 + variantName.length + 3
    size += (depth + 1) * 2 + 2
  }

  // ~1.95x is a rough growth factor due to the actual properties being present
  return size * 1.95
}

const UNITS = ['byte', 'kilobyte', 'megabyte', 'gigabyte', 'terabyte', 'petabyte']
function formatBytes(n: number) {
  let i = n == 0 ? 0 : Math.floor(Math.log(n) / Math.log(1000))
  return new Intl.NumberFormat('en', {
    notation: 'compact',
    style: 'unit',
    unit: UNITS[i],
    unitDisplay: 'narrow',
  }).format(n / 1000 ** i)
}
