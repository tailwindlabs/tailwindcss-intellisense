import type { Range, TextDocument } from 'vscode-languageserver-textdocument'
import type { State } from './util/state'
import type { CodeLens } from 'vscode-languageserver'
import braces from 'braces'
import { findAll, indexToPosition } from './util/find'
import { absoluteRange } from './util/absoluteRange'

export async function getCodeLens(state: State, doc: TextDocument): Promise<CodeLens[]> {
  if (!state.enabled) return []

  let groups: CodeLens[][] = await Promise.all([
    //
    sourceInlineCodeLens(state, doc),
  ])

  return groups.flat()
}

const SOURCE_INLINE_PATTERN = /@source(?:\s+not)?\s*inline\((?<glob>'[^']+'|"[^"]+")/dg
async function sourceInlineCodeLens(state: State, doc: TextDocument): Promise<CodeLens[]> {
  let text = doc.getText()

  let countFormatter = new Intl.NumberFormat('en', {
    maximumFractionDigits: 2,
  })

  let lenses: CodeLens[] = []

  for (let match of findAll(SOURCE_INLINE_PATTERN, text)) {
    let glob = match.groups.glob.slice(1, -1)

    // Perform brace expansion
    let expanded = new Set<string>(braces.expand(glob))
    if (expanded.size < 2) continue

    let slice: Range = absoluteRange({
      start: indexToPosition(text, match.indices.groups.glob[0]),
      end: indexToPosition(text, match.indices.groups.glob[1]),
    })

    lenses.push({
      range: slice,
      command: {
        title: `Generates ${countFormatter.format(expanded.size)} classes`,
        command: '',
      },
    })
  }

  return lenses
}
