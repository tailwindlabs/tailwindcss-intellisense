import picomatch from 'picomatch'
import * as path from 'node:path'
import type { TextDocument } from 'vscode-languageserver-textdocument'
import type { State } from '@tailwindcss/language-service/src/util/state'
import { getFileFsPath } from './uri'
import { normalizePath, normalizeDriveLetter } from '../utils'

export default async function isExcluded(
  state: State,
  document: TextDocument,
  file: string = getFileFsPath(document.uri),
): Promise<boolean> {
  let settings = await state.editor.getConfiguration(document.uri)

  file = normalizePath(file)
  file = normalizeDriveLetter(file)

  for (let pattern of settings.tailwindCSS.files.exclude) {
    pattern = path.join(state.editor.folder, pattern)
    pattern = normalizePath(pattern)
    pattern = normalizeDriveLetter(pattern)

    if (picomatch(pattern)(file)) {
      return true
    }
  }

  return false
}
