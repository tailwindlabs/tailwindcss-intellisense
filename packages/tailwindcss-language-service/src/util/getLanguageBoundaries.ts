import type { Range } from 'vscode-languageserver'
import type { TextDocument } from 'vscode-languageserver-textdocument'
import { isVueDoc, isHtmlDoc, isSvelteDoc } from './html'
import { State } from './state'
import { indexToPosition } from './find'
import { isJsDoc } from './js'
import moo from 'moo'
import Cache from 'tmp-cache'
import { getTextWithoutComments } from './doc'

export type LanguageBoundary = { type: 'html' | 'js' | 'css' | (string & {}); range: Range }

let htmlScriptTypes = [
  // https://v3-migration.vuejs.org/breaking-changes/inline-template-attribute.html#option-1-use-script-tag
  'text/html',
  // https://vuejs.org/guide/essentials/component-basics.html#dom-template-parsing-caveats
  'text/x-template',
  // https://github.com/tailwindlabs/tailwindcss-intellisense/issues/722
  'text/x-handlebars-template',
]

let text = { text: { match: /[^]/, lineBreaks: true } }

let states = {
  main: {
    cssBlockStart: { match: /<style(?=[>\s])/, push: 'cssBlock' },
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
    typeAttrStartDouble: { match: 'type="', push: 'typeAttrDouble' },
    typeAttrStartSingle: { match: "type='", push: 'typeAttrSingle' },
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
  typeAttrDouble: {
    langAttrEnd: { match: '"', pop: 1 },
    type: { match: /[^"]+/, lineBreaks: true },
  },
  typeAttrSingle: {
    langAttrEnd: { match: "'", pop: 1 },
    type: { match: /[^']+/, lineBreaks: true },
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
    cssBlockEnd: { match: /<\/style\s*>/, pop: 1 },
    ...text,
  },
  script: {
    jsBlockEnd: { match: /<\/script\s*>/, pop: 1 },
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

  let isJs = isJsDoc(state, doc)

  let defaultType = isVueDoc(doc)
    ? 'none'
    : isHtmlDoc(state, doc) || isSvelteDoc(doc)
    ? 'html'
    : isJs
    ? 'jsx'
    : null

  if (defaultType === null) {
    cache.set(cacheKey, null)
    return null
  }

  text = getTextWithoutComments(text, isJs ? 'js' : 'html')

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
        } else if (token.type === 'type' && htmlScriptTypes.includes(token.text)) {
          boundaries[boundaries.length - 1].type = 'html'
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
