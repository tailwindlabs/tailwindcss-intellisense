import type { Position } from 'vscode-languageserver'
import type { TextDocument } from 'vscode-languageserver-textdocument'
import type { State } from './state'
import { jsLanguages } from './languages'
import { getLanguageBoundaries } from './getLanguageBoundaries'

export function isJsDoc(state: State, doc: TextDocument): boolean {
  const userJsLanguages = Object.keys(state.editor.userLanguages).filter((lang) =>
    jsLanguages.includes(state.editor.userLanguages[lang]),
  )

  return [...jsLanguages, ...userJsLanguages].indexOf(doc.languageId) !== -1
}

export function isJsContext(state: State, doc: TextDocument, position: Position): boolean {
  let str = doc.getText({
    start: { line: 0, character: 0 },
    end: position,
  })

  let boundaries = getLanguageBoundaries(state, doc, str)

  return boundaries
    ? ['js', 'ts', 'jsx', 'tsx'].includes(boundaries[boundaries.length - 1].type)
    : false
}

export function isJsxContext(state: State, doc: TextDocument, position: Position): boolean {
  let str = doc.getText({
    start: { line: 0, character: 0 },
    end: position,
  })

  let boundaries = getLanguageBoundaries(state, doc, str)

  return boundaries ? ['jsx', 'tsx'].includes(boundaries[boundaries.length - 1].type) : false
}
