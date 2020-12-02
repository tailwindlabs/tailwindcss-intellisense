import type { TextDocument, Range } from 'vscode-languageserver'
import { isVueDoc, isHtmlDoc, isSvelteDoc } from './html'
import { State } from './state'
import { findAll, indexToPosition } from './find'
import { isJsDoc } from './js'

export interface LanguageBoundaries {
  html: Range[]
  css: Range[]
}

export function getLanguageBoundaries(
  state: State,
  doc: TextDocument
): LanguageBoundaries | null {
  if (isVueDoc(doc)) {
    let text = doc.getText()
    let blocks = findAll(
      /(?<open><(?<type>template|style|script)\b[^>]*>).*?(?<close><\/\k<type>>|$)/gis,
      text
    )
    let htmlRanges: Range[] = []
    let cssRanges: Range[] = []
    for (let i = 0; i < blocks.length; i++) {
      let range = {
        start: indexToPosition(
          text,
          blocks[i].index + blocks[i].groups.open.length
        ),
        end: indexToPosition(
          text,
          blocks[i].index + blocks[i][0].length - blocks[i].groups.close.length
        ),
      }
      if (blocks[i].groups.type === 'style') {
        cssRanges.push(range)
      } else {
        htmlRanges.push(range)
      }
    }

    return {
      html: htmlRanges,
      css: cssRanges,
    }
  }

  if (isHtmlDoc(state, doc) || isJsDoc(state, doc) || isSvelteDoc(doc)) {
    let text = doc.getText()
    let styleBlocks = findAll(
      /(?<open><style(?:\s[^>]*>|>)).*?(?<close><\/style>|$)/gis,
      text
    )
    let htmlRanges: Range[] = []
    let cssRanges: Range[] = []
    let currentIndex = 0

    for (let i = 0; i < styleBlocks.length; i++) {
      htmlRanges.push({
        start: indexToPosition(text, currentIndex),
        end: indexToPosition(text, styleBlocks[i].index),
      })
      cssRanges.push({
        start: indexToPosition(
          text,
          styleBlocks[i].index + styleBlocks[i].groups.open.length
        ),
        end: indexToPosition(
          text,
          styleBlocks[i].index +
            styleBlocks[i][0].length -
            styleBlocks[i].groups.close.length
        ),
      })
      currentIndex = styleBlocks[i].index + styleBlocks[i][0].length
    }
    htmlRanges.push({
      start: indexToPosition(text, currentIndex),
      end: indexToPosition(text, text.length),
    })

    return {
      html: htmlRanges,
      css: cssRanges,
    }
  }

  return null
}
