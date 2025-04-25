import type { State } from '../util/state'
import type { Range } from 'vscode-languageserver'
import type { TextDocument } from 'vscode-languageserver-textdocument'
import { getLanguageBoundaries } from '../util/getLanguageBoundaries'
import { isCssDoc } from '../util/css'
import { getTextWithoutComments } from './doc'

export interface LanguageBlock {
  document: TextDocument
  range: Range | undefined
  lang: string
  readonly text: string
}

export function* getCssBlocks(
  state: State,
  document: TextDocument,
): Iterable<LanguageBlock | undefined> {
  if (isCssDoc(state, document)) {
    yield {
      document,
      range: undefined,
      lang: document.languageId,
      get text() {
        return getTextWithoutComments(document, 'css')
      },
    }
  } else {
    let boundaries = getLanguageBoundaries(state, document)
    if (!boundaries) return []

    for (let boundary of boundaries) {
      if (boundary.type !== 'css') continue

      yield {
        document,
        range: boundary.range,
        lang: boundary.lang ?? document.languageId,
        get text() {
          return getTextWithoutComments(document, 'css', boundary.range)
        },
      }
    }
  }
}
