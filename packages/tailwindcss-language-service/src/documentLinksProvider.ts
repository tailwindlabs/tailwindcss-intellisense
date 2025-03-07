import type { TextDocument } from 'vscode-languageserver-textdocument'
import type { State } from './util/state'
import type { DocumentLink, Range } from 'vscode-languageserver'
import { findAll, indexToPosition } from './util/find'
import { absoluteRange } from './util/absoluteRange'
import * as semver from './util/semver'
import { getCssBlocks } from './util/language-blocks'

const HAS_DRIVE_LETTER = /^[A-Z]:/

export function getDocumentLinks(
  state: State,
  document: TextDocument,
  resolveTarget: (linkPath: string) => Promise<string>,
): Promise<DocumentLink[]> {
  let patterns = [/@config\s*(?<path>'[^']+'|"[^"]+")/g]

  if (state.v4) {
    patterns.push(
      /@plugin\s*(?<path>'[^']+'|"[^"]+")/g,
      /@source(?:\s+not)?\s*(?<path>'[^']+'|"[^"]+")/g,
      /@import\s*('[^']*'|"[^"]*")\s*(layer\([^)]+\)\s*)?source\((?<path>'[^']*'?|"[^"]*"?)/g,
      /@reference\s*('[^']*'|"[^"]*")\s*source\((?<path>'[^']*'?|"[^"]*"?)/g,
      /@tailwind\s*utilities\s*source\((?<path>'[^']*'?|"[^"]*"?)/g,
    )
  }

  return getDirectiveLinks(state, document, patterns, resolveTarget)
}

async function getDirectiveLinks(
  state: State,
  document: TextDocument,
  patterns: RegExp[],
  resolveTarget: (linkPath: string) => Promise<string>,
): Promise<DocumentLink[]> {
  if (!semver.gte(state.version, '3.2.0')) {
    return []
  }

  let links: DocumentLink[] = []

  for (let block of getCssBlocks(state, document)) {
    let text = block.text

    let matches: RegExpMatchArray[] = []

    for (let pattern of patterns) {
      matches.push(...findAll(pattern, text))
    }

    for (let match of matches) {
      let path = match.groups.path.slice(1, -1)

      // Ignore glob-like paths
      if (path.includes('*') || path.includes('{') || path.includes('}')) {
        continue
      }

      // Ignore Windows-style paths
      if (path.includes('\\') || HAS_DRIVE_LETTER.test(path)) {
        continue
      }

      let range = {
        start: indexToPosition(text, match.index + match[0].length - match.groups.path.length),
        end: indexToPosition(text, match.index + match[0].length),
      }

      links.push({
        target: await resolveTarget(path),
        range: absoluteRange(range, block.range),
      })
    }
  }

  return links
}
