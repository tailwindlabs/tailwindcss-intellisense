import type { TextDocument } from 'vscode-languageserver-textdocument'
import type { State } from './util/state'
import type { CodeLens } from 'vscode-languageserver'

import * as features from './features/index'

export async function getCodeLens(state: State, document: TextDocument): Promise<CodeLens[]> {
  if (!state.enabled) return []

  console.log('getCodeLens')

  let groups: CodeLens[][] = await Promise.all([
    // features.project.provideCodeLens(state, document),
    features.sourceInline.provideCodeLens(state, document),
  ])

  return groups.flat()
}
