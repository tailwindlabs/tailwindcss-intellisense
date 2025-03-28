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

  let configs: Array<() => Thenable<Uri[]>> = []
  let stylesheets: Array<() => Thenable<Uri[]>> = []

  for (let folder of folders) {
    let exclusions = getExcludePatterns(folder).flatMap((pattern) => braces.expand(pattern))
    let exclude = `{${exclusions.join(',').replace(/{/g, '%7B').replace(/}/g, '%7D')}}`

    configs.push(() =>
      workspace.findFiles(
        new RelativePattern(folder, `**/${CONFIG_GLOB}`),
        exclude,
        undefined,
        token,
      ),
    )

    stylesheets.push(() =>
      workspace.findFiles(new RelativePattern(folder, `**/${CSS_GLOB}`), exclude, undefined, token),
    )
  }

  // If we find a config file then we need the server
  let configUrls = await Promise.all(configs.map((fn) => fn()))
  for (let group of configUrls) {
    if (group.length > 0) {
      return true
    }
  }

  // If we find a possibly-related stylesheet then we need the server
  // The step is done last because it requires reading individual files
  // to determine if the server should be started.
  //
  // This is also, unfortunately, prone to starting the server unncessarily
  // in projects that don't use TailwindCSS so we do this one-by-one instead
  // of all at once to keep disk I/O low.
  let stylesheetUrls = await Promise.all(stylesheets.map((fn) => fn()))
  for (let group of stylesheetUrls) {
    for (let file of group) {
      if (await fileMayBeTailwindRelated(file)) {
        return true
      }
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

  return (
    HAS_CONFIG.test(contents) ||
    HAS_IMPORT.test(contents) ||
    HAS_TAILWIND.test(contents) ||
    HAS_THEME.test(contents)
  )
}
