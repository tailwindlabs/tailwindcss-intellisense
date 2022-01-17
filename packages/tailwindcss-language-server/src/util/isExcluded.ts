import minimatch from 'minimatch'
import * as path from 'path'
import { State } from 'tailwindcss-language-service/src/util/state'
import { TextDocument } from 'vscode-languageserver-textdocument'
import { getFileFsPath } from './uri'

export const DEFAULT_FILES_EXCLUDE = ['**/.git/**', '**/.svn/**', '**/.hg/**', '**/node_modules/**']

export default async function isExcluded(state: State, document: TextDocument): Promise<boolean> {
  let settings = await state.editor.getConfiguration(document.uri)
  let file = getFileFsPath(document.uri)

  for (let pattern of settings.tailwindCSS.files?.exclude ?? DEFAULT_FILES_EXCLUDE) {
    if (minimatch(file, path.join(state.editor.folder, pattern))) {
      return true
    }
  }

  return false
}
