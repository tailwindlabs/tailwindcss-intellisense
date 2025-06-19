import type { Position } from 'vscode-languageserver'
import type { TextDocument } from 'vscode-languageserver-textdocument'
import type { State } from './state'
import { htmlLanguages } from './languages'
import { getLanguageBoundaries } from './getLanguageBoundaries'

export function isHtmlDoc(state: State, doc: TextDocument): boolean {
  const userHtmlLanguages = Object.keys(state.editor.userLanguages).filter((lang) =>
    htmlLanguages.includes(state.editor.userLanguages[lang]),
  )

  return [...htmlLanguages, ...userHtmlLanguages].indexOf(doc.languageId) !== -1
}

export function isVueDoc(doc: TextDocument): boolean {
  return doc.languageId === 'vue'
}

export function isSvelteDoc(doc: TextDocument): boolean {
  return doc.languageId === 'svelte'
}

export function isAstroDoc(doc: TextDocument): boolean {
  return doc.languageId === 'astro'
}

export function isHtmlContext(state: State, doc: TextDocument, position: Position): boolean {
  let str = doc.getText({
    start: { line: 0, character: 0 },
    end: position,
  })

  let boundaries = getLanguageBoundaries(state, doc, str)

  return boundaries ? boundaries[boundaries.length - 1].type === 'html' : false
}
