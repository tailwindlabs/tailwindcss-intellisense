import minimatch from 'minimatch'
import * as path from 'path'
import { Settings, State } from 'tailwindcss-language-service/src/util/state'
import { TextDocument } from 'vscode-languageserver-textdocument'
import { getFileFsPath } from './uri'

export default async function isExcluded(
  state: State,
  document: TextDocument,
  file: string = getFileFsPath(document.uri)
): Promise<boolean> {
  let settings = await state.editor.getConfiguration(document.uri)

  for (let pattern of settings.tailwindCSS.files.exclude) {
    if (minimatch(file, path.join(state.editor.folder, pattern))) {
      return true
    }
  }

  return false
}

export async function isExcludedOnComplete(
  state: State,
  document: TextDocument,
  settings: Settings,
  file: string = getFileFsPath(document.uri)
): Promise<boolean> {
  for (let pattern of settings.tailwindCSS.files.exclude) {
    if (minimatch(file, path.join(state.editor.folder, pattern))) {
      return true
    }
  }

  return false
}
