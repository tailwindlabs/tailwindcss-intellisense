import type { TextDocument } from 'vscode-languageserver-textdocument'
import type { State } from './util/state'
import type { DocumentLink, Range } from 'vscode-languageserver'
import { isCssDoc } from './util/css'
import { getLanguageBoundaries } from './util/getLanguageBoundaries'
import { findAll, indexToPosition } from './util/find'
import { getTextWithoutComments } from './util/doc'
import { absoluteRange } from './util/absoluteRange'
import * as semver from './util/semver'

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
  let ranges: Range[] = []

  if (isCssDoc(state, document)) {
    ranges.push(undefined)
  } else {
    let boundaries = getLanguageBoundaries(state, document)
    if (!boundaries) return []
    ranges.push(...boundaries.filter((b) => b.type === 'css').map(({ range }) => range))
  }

  for (let range of ranges) {
    let text = getTextWithoutComments(document, 'css', range)
    let matches: RegExpMatchArray[] = []

    for (let pattern of patterns) {
      matches.push(...findAll(pattern, text))
    }

    for (let match of matches) {
      links.push({
        target: resolveTarget(match.groups.path.slice(1, -1)),
        range: absoluteRange(
          {
            start: indexToPosition(text, match.index + match[0].length - match.groups.path.length),
            end: indexToPosition(text, match.index + match[0].length),
          },
          range,
        ),
      })
    }
  }

  return links
}
