import { onMessage } from '../notifications'
import { State } from '../util/state'
import { getDocumentColors } from 'tailwindcss-language-service'

export function registerDocumentColorProvider(state: State) {
  onMessage(
    state.editor.connection,
    'getDocumentColors',
    async ({ document }) => {
      let doc = state.editor.documents.get(document)
      if (!doc) return { colors: [] }

      return { colors: getDocumentColors(state, doc) }
    }
  )
}
