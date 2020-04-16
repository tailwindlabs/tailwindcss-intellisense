import { State, Settings } from './state'

export async function getDocumentSettings(
  state: State,
  resource: string
): Promise<Settings> {
  if (!state.editor.capabilities.configuration) {
    return Promise.resolve(state.editor.globalSettings)
  }
  let result = state.editor.documentSettings.get(resource)
  if (!result) {
    result = await state.editor.connection.workspace.getConfiguration({
      scopeUri: resource,
      section: 'tailwindCSS',
    })
    state.editor.documentSettings.set(resource, result)
  }
  return result
}
