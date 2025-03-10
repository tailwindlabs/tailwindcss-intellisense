import picomatch from 'picomatch'
import * as path from 'node:path'
import type { TextDocument } from 'vscode-languageserver-textdocument'
import type { State } from '@tailwindcss/language-service/src/util/state'
import { getFileFsPath } from './uri'

export default async function isExcluded(
  state: State,
  document: TextDocument,
  file: string = getFileFsPath(document.uri),
): Promise<boolean> {
  let settings = await state.editor.getConfiguration(document.uri)

  for (let pattern of settings.tailwindCSS.files.exclude) {
    if (picomatch(path.join(state.editor.folder, pattern))(file)) {
      return true
    }
  }

  return false
}
