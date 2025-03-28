import {
  workspace,
  type WorkspaceConfiguration,
  type ConfigurationScope,
  type WorkspaceFolder,
} from 'vscode'
import picomatch from 'picomatch'
import * as path from 'node:path'

function getGlobalExcludePatterns(scope: ConfigurationScope | null): string[] {
  return Object.entries(workspace.getConfiguration('files', scope)?.get('exclude') ?? [])
    .filter(([, value]) => value === true)
    .map(([key]) => key)
    .filter(Boolean)
}

export function getExcludePatterns(scope: ConfigurationScope | null): string[] {
  return [
    ...getGlobalExcludePatterns(scope),
    ...(<string[]>workspace.getConfiguration('tailwindCSS', scope).get('files.exclude')).filter(
      Boolean,
    ),
  ]
}

export function isExcluded(file: string, folder: WorkspaceFolder): boolean {
  for (let pattern of getExcludePatterns(folder)) {
    let matcher = picomatch(path.join(folder.uri.fsPath, pattern))

    if (matcher(file)) {
      return true
    }
  }

  return false
}

export function mergeExcludes(
  settings: WorkspaceConfiguration,
  scope: ConfigurationScope | null,
): any {
  return {
    ...settings,
    files: {
      ...settings.files,
      exclude: getExcludePatterns(scope),
    },
  }
}
