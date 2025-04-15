import type { Span, State } from '../util/state'
import type { TextDocument, Range } from 'vscode-languageserver-textdocument'
import { getLanguageBoundaries } from '../util/getLanguageBoundaries'
import { isCssDoc } from '../util/css'
import { getTextWithoutComments } from './doc'
import { isHtmlDoc } from './html'
import { isJsDoc } from './js'

export interface LanguageBlock {
  context: 'html' | 'js' | 'css' | 'other'
  range: Range | undefined
  span: Span | undefined
  lang: string
  text: string
}

export function getDocumentBlocks(state: State, doc: TextDocument): LanguageBlock[] {
  let text = doc.getText()

  let boundaries = getLanguageBoundaries(state, doc, text)
  if (boundaries && boundaries.length > 0) {
    return boundaries.map((boundary) => {
      let context: 'html' | 'js' | 'css' | 'other'

      if (boundary.type === 'html') {
        context = 'html'
      } else if (boundary.type === 'css') {
        context = 'css'
      } else if (boundary.type === 'js' || boundary.type === 'jsx') {
        context = 'js'
      } else {
        context = 'other'
      }

      let text = doc.getText(boundary.range)

      return {
        context,
        range: boundary.range,
        span: boundary.span,
        lang: boundary.lang ?? doc.languageId,
        text: context === 'other' ? text : getTextWithoutComments(text, context),
      }
    })
  }

  // If we get here we most likely have non-HTML document in a single language
  let context: 'html' | 'js' | 'css' | 'other'

  if (isHtmlDoc(state, doc)) {
    context = 'html'
  } else if (isCssDoc(state, doc)) {
    context = 'css'
  } else if (isJsDoc(state, doc)) {
    context = 'js'
  } else {
    context = 'other'
  }

  return [
    {
      context,
      range: {
        start: doc.positionAt(0),
        end: doc.positionAt(text.length),
      },
      span: [0, text.length],
      lang: doc.languageId,
      text: context === 'other' ? text : getTextWithoutComments(text, context),
    },
  ]
}

export function getCssBlocks(state: State, document: TextDocument): LanguageBlock[] {
  return getDocumentBlocks(state, document).filter((block) => block.context === 'css')
}
