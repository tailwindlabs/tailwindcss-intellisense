/**
 * Support for `@source inline(…)`
 */

import type { Range, TextDocument } from 'vscode-languageserver-textdocument'
import type { State } from '../util/state'
import type { CodeLens } from 'vscode-languageserver'
import braces from 'braces'
import { findAll, indexToPosition } from '../util/find'
import { absoluteRange } from '../util/absoluteRange'

const PATTERN = /@source(?:\s+not)?\s*inline\((?<glob>'[^']+'|"[^"]+")/dg

export async function provideCodeLens(state: State, doc: TextDocument): Promise<CodeLens[]> {
  let text = doc.getText()

  let lenses: CodeLens[] = []

  for (let match of findAll(PATTERN, text)) {
    let glob = match.groups.glob.slice(1, -1)

    // Perform brace expansion
    let expanded = new Set(braces.expand(glob))
    if (expanded.size < 2) continue

    let slice: Range = absoluteRange({
      start: indexToPosition(text, match.indices.groups.glob[0]),
      end: indexToPosition(text, match.indices.groups.glob[1]),
    })

    lenses.push({
      range: slice,
      command: {
        title: `Generates ${expanded.size} classes`,
        command: '',
      },
    })
  }

  return lenses
}
