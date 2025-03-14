import type { TextDocument } from 'vscode-languageserver-textdocument'
import type { State } from '../util/state'
import type { CodeLens } from 'vscode-languageserver'

export async function provideCodeLens(state: State, doc: TextDocument): Promise<CodeLens[]> {
  return [
    {
      range: {
        start: { line: 0, character: 0 },
        end: { line: 0, character: 0 },
      },
      command: {
        title: `≈ Tailwind CSS v${state.version} — ${state.configPath}`,
        command: '',
      },
    },
  ]
}
