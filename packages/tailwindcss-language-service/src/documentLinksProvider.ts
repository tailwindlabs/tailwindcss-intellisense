import type { TextDocument } from 'vscode-languageserver-textdocument'
import type { State } from './util/state'
import type { DocumentLink, Range } from 'vscode-languageserver'
import { isCssDoc } from './util/css'
import { getLanguageBoundaries } from './util/getLanguageBoundaries'
import { findAll, indexToPosition } from './util/find'
import { getTextWithoutComments } from './util/doc'
import { absoluteRange } from './util/absoluteRange'
import * as semver from './util/semver'
import { getCssBlocks } from './util/language-blocks'

export function getDocumentLinks(
  state: State,
  document: TextDocument,
  resolveTarget: (linkPath: string) => string,
): DocumentLink[] {
  let patterns = [
    /@config\s*(?<path>'[^']+'|"[^"]+")/g,
  ]

  if (state.v4) {
    patterns.push(
      /@plugin\s*(?<path>'[^']+'|"[^"]+")/g,
      /@source\s*(?<path>'[^']+'|"[^"]+")/g,
      /@import\s*('[^']*'|"[^"]*")\s*source\((?<path>'[^']*'?|"[^"]*"?)/g,
      /@tailwind\s*utilities\s*source\((?<path>'[^']*'?|"[^"]*"?)/g,
    )
  }

  return getDirectiveLinks(state, document, patterns, resolveTarget)
}

function getDirectiveLinks(
  state: State,
  document: TextDocument,
  patterns: RegExp[],
  resolveTarget: (linkPath: string) => string,
): DocumentLink[] {
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

      let range = {
        start: indexToPosition(text, match.index + match[0].length - match.groups.path.length),
        end: indexToPosition(text, match.index + match[0].length),
      }

      links.push({
        target: resolveTarget(path),
        range: absoluteRange(range, block.range),
      })
    }
  }

  return links
}
