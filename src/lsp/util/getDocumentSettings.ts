import { State, Settings } from './state'
import { TextDocument } from 'vscode-languageserver'

export async function getDocumentSettings(
  state: State,
  document: TextDocument
): Promise<Settings> {
  if (!state.editor.capabilities.configuration) {
    return Promise.resolve(state.editor.globalSettings)
  }
  let result = state.editor.documentSettings.get(document.uri)
  if (!result) {
    result = await state.emitter.emit('getConfiguration', {
      languageId: document.languageId,
    })
    state.editor.documentSettings.set(document.uri, result)
  }
  return result
}
