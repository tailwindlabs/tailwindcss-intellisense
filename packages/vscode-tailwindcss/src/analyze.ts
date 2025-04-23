import { workspace, RelativePattern, CancellationToken, Uri, WorkspaceFolder } from 'vscode'
import braces from 'braces'
import { CONFIG_GLOB, CSS_GLOB } from '@tailwindcss/language-server/src/lib/constants'
import { getExcludePatterns } from './exclusions'

export interface SearchOptions {
  folders: readonly WorkspaceFolder[]
  token: CancellationToken
}

export async function anyWorkspaceFoldersNeedServer({ folders, token }: SearchOptions) {
  // An explicit config file setting means we need the server
  for (let folder of folders) {
    let settings = workspace.getConfiguration('tailwindCSS', folder)
    let configFilePath = settings.get('experimental.configFile')

    // No setting provided
    if (!configFilePath) continue

    // Ths config file may be a string:
    // A path pointing to a CSS or JS config file
    if (typeof configFilePath === 'string') return true

    // Ths config file may be an object:
    // A map of config files to one or more globs
    //
    // If we get an empty object the language server will do a search anyway so
    // we'll act as if no option was passed to be consistent
    if (typeof configFilePath === 'object' && Object.values(configFilePath).length > 0) return true
  }

  // If any search returns that it needs a workspace then the server needs to be started
  // and the remainder of the searches will be cancelled
  let searches = folders.map((folder) =>
    workspaceFoldersNeedServer({ folder, token }).then((found) => {
      if (found) return true

      // We use `throw` so we can use Promise.any(…)
      throw new Error(DUMMY_ERROR_MESSAGE)
    }),
  )

  const DUMMY_ERROR_MESSAGE = 'Workspace folder not needed'

  try {
    return await Promise.any(searches)
  } catch (err) {
    for (let anErr of (err as AggregateError).errors ?? []) {
      if (typeof anErr === 'object' && err.message === DUMMY_ERROR_MESSAGE) {
        continue
      }

      console.error(anErr)
    }

    return false
  }
}

export interface FolderSearchOptions {
  folder: WorkspaceFolder
  token: CancellationToken
}

async function workspaceFoldersNeedServer({ folder, token }: FolderSearchOptions) {
  let exclusions = getExcludePatterns(folder).flatMap((pattern) => braces.expand(pattern))
  let exclude = `{${exclusions.join(',').replace(/{/g, '%7B').replace(/}/g, '%7D')}}`

  // If we find a config file then we need the server
  let configs = await workspace.findFiles(
    new RelativePattern(folder, `**/${CONFIG_GLOB}`),
    exclude,
    undefined,
    token,
  )

  if (configs.length > 0) {
    return true
  }

  // If we find a possibly-related stylesheet then we need the server
  // The step is done last because it requires reading individual files
  // to determine if the server should be started.
  //
  // This is also, unfortunately, prone to starting the server unncessarily
  // in projects that don't use TailwindCSS so we do this one-by-one instead
  // of all at once to keep disk I/O low.
  let stylesheets = await workspace.findFiles(
    new RelativePattern(folder, `**/${CSS_GLOB}`),
    exclude,
    undefined,
    token,
  )

  for (let file of stylesheets) {
    if (await fileMayBeTailwindRelated(file)) {
      return true
    }
  }
}

let HAS_CONFIG = /@config\s*['"]/
let HAS_IMPORT = /@import\s*['"]/
let HAS_TAILWIND = /@tailwind\s*[^;]+;/
let HAS_THEME = /@theme\s*\{/

export async function fileMayBeTailwindRelated(uri: Uri) {
  let buffer = await workspace.fs.readFile(uri)
  let contents = buffer.toString()

  // This is a clear signal that this is Tailwind related in v0–v4
  if (HAS_CONFIG.test(contents)) return true

  if (uri.path.endsWith('.css')) {
    // In v4 these are Tailwind related *in .css files only*
    // other stylesheets like lesss, stylus, etc… don't consider these files
    if (HAS_THEME.test(contents)) return true
    if (HAS_TAILWIND.test(contents)) return true

    // @import *might* signal the need for the language server we'll have to
    // start it, let it check, and hope we were right.
    if (HAS_IMPORT.test(contents)) return true
  }

  return false
}
