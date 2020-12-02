import { State, Settings } from './state'
import type { TextDocument } from 'vscode-languageserver'

export async function getDocumentSettings(
  state: State,
  document?: TextDocument
): Promise<Settings> {
  if (!state.editor.capabilities.configuration) {
    return Promise.resolve(state.editor.globalSettings)
  }
  const uri = document ? document.uri : undefined
  let result = state.editor.documentSettings.get(uri)
  if (!result) {
    result = await state.emitter.emit(
      'getConfiguration',
      document
        ? {
            languageId: document.languageId,
          }
        : undefined
    )
    state.editor.documentSettings.set(uri, result)
  }
  return result
}
