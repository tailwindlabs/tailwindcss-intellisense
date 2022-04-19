import type { TextDocument, Range } from 'vscode-languageserver'
import { isVueDoc, isHtmlDoc, isSvelteDoc } from './html'
import { State } from './state'
import { indexToPosition } from './find'
import { isJsDoc } from './js'
import moo from 'moo'
import Cache from 'tmp-cache'

export type LanguageBoundary = { type: 'html' | 'js' | 'css' | string; range: Range }

let text = { text: { match: /[^]/, lineBreaks: true } }

let states = {
  main: {
    cssBlockStart: { match: '<style', push: 'cssBlock' },
    jsBlockStart: { match: '<script', push: 'jsBlock' },
    ...text,
  },
  cssBlock: {
    styleStart: { match: '>', next: 'style' },
    cssBlockEnd: { match: '/>', pop: 1 },
    attrStartDouble: { match: '"', push: 'attrDouble' },
    attrStartSingle: { match: "'", push: 'attrSingle' },
    interp: { match: '{', push: 'interp' },
    ...text,
  },
  jsBlock: {
    scriptStart: { match: '>', next: 'script' },
    jsBlockEnd: { match: '/>', pop: 1 },
    langAttrStartDouble: { match: 'lang="', push: 'langAttrDouble' },
    langAttrStartSingle: { match: "lang='", push: 'langAttrSingle' },
    attrStartDouble: { match: '"', push: 'attrDouble' },
    attrStartSingle: { match: "'", push: 'attrSingle' },
    interp: { match: '{', push: 'interp' },
    ...text,
  },
  interp: {
    interp: { match: '{', push: 'interp' },
    end: { match: '}', pop: 1 },
    ...text,
  },
  langAttrDouble: {
    langAttrEnd: { match: '"', pop: 1 },
    lang: { match: /[^"]+/, lineBreaks: true },
  },
  langAttrSingle: {
    langAttrEnd: { match: "'", pop: 1 },
    lang: { match: /[^']+/, lineBreaks: true },
  },
  attrDouble: {
    attrEnd: { match: '"', pop: 1 },
    ...text,
  },
  attrSingle: {
    attrEnd: { match: "'", pop: 1 },
    ...text,
  },
  style: {
    cssBlockEnd: { match: '</style>', pop: 1 },
    ...text,
  },
  script: {
    jsBlockEnd: { match: '</script>', pop: 1 },
    ...text,
  },
}

let vueStates = {
  ...states,
  main: {
    htmlBlockStart: { match: '<template', push: 'htmlBlock' },
    ...states.main,
  },
  htmlBlock: {
    htmlStart: { match: '>', next: 'html' },
    htmlBlockEnd: { match: '/>', pop: 1 },
    attrStartDouble: { match: '"', push: 'attrDouble' },
    attrStartSingle: { match: "'", push: 'attrSingle' },
    interp: { match: '{', push: 'interp' },
    ...text,
  },
  html: {
    htmlBlockEnd: { match: '</template>', pop: 1 },
    nestedBlockStart: { match: '<template', push: 'nestedBlock' },
    ...text,
  },
  nestedBlock: {
    nestedStart: { match: '>', next: 'nested' },
    nestedBlockEnd: { match: '/>', pop: 1 },
    ...text,
  },
  nested: {
    nestedBlockEnd: { match: '</template>', pop: 1 },
    nestedBlockStart: { match: '<template', push: 'nestedBlock' },
    ...text,
  },
}

let defaultLexer = moo.states(states)
let vueLexer = moo.states(vueStates)

let cache = new Cache<string, LanguageBoundary[] | null>({ max: 25, maxAge: 1000 })

export function getLanguageBoundaries(
  state: State,
  doc: TextDocument,
  text: string = doc.getText()
): LanguageBoundary[] | null {
  let cacheKey = `${doc.languageId}:${text}`

  let cachedBoundaries = cache.get(cacheKey)
  if (cachedBoundaries !== undefined) {
    return cachedBoundaries
  }

  let defaultType = isVueDoc(doc)
    ? 'none'
    : isHtmlDoc(state, doc) || isJsDoc(state, doc) || isSvelteDoc(doc)
    ? 'html'
    : null

  if (defaultType === null) {
    cache.set(cacheKey, null)
    return null
  }

  let lexer = defaultType === 'none' ? vueLexer : defaultLexer
  lexer.reset(text)

  let type = defaultType
  let boundaries: LanguageBoundary[] = [
    { type: defaultType, range: { start: { line: 0, character: 0 }, end: undefined } },
  ]
  let offset = 0

  try {
    for (let token of lexer) {
      if (!token.type.startsWith('nested')) {
        if (token.type.endsWith('BlockStart')) {
          let position = indexToPosition(text, offset)
          if (!boundaries[boundaries.length - 1].range.end) {
            boundaries[boundaries.length - 1].range.end = position
          }
          type = token.type.replace(/BlockStart$/, '')
          boundaries.push({ type, range: { start: position, end: undefined } })
        } else if (token.type.endsWith('BlockEnd')) {
          let position = indexToPosition(text, offset)
          boundaries[boundaries.length - 1].range.end = position
          boundaries.push({ type: defaultType, range: { start: position, end: undefined } })
        } else if (token.type === 'lang') {
          boundaries[boundaries.length - 1].type = token.text
        }
      }
      offset += token.text.length
    }
  } catch {
    cache.set(cacheKey, null)
    return null
  }

  if (!boundaries[boundaries.length - 1].range.end) {
    boundaries[boundaries.length - 1].range.end = indexToPosition(text, offset)
  }

  cache.set(cacheKey, boundaries)

  return boundaries
}
