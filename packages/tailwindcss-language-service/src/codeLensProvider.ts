import type { TextDocument } from 'vscode-languageserver-textdocument'
import type { State } from './util/state'
import type { CodeLens } from 'vscode-languageserver'

export async function getCodeLens(state: State, doc: TextDocument): Promise<CodeLens[]> {
  if (!state.enabled) return []

  let groups: CodeLens[][] = await Promise.all([
    //
  ])

  return groups.flat()
}
