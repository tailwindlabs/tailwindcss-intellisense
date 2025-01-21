import Module from 'node:module'
import * as path from 'node:path'
import { URI } from 'vscode-uri'
import normalizePathBase from 'normalize-path'
import { pathToFileURL as pathToFileURLBase } from 'node:url'

export function withoutLogs<T>(getter: () => T): T {
  let fns = {
    log: console.log,
    warn: console.warn,
    error: console.error,
  }
  for (let key in fns) {
    console[key] = () => {}
  }
  try {
    return getter()
  } finally {
    for (let key in fns) {
      console[key] = fns[key]
    }
  }
}

export function first<T>(...options: Array<() => T>): T {
  for (let i = 0; i < options.length; i++) {
    let option = options[i]
    if (i === options.length - 1) {
      return option()
    } else {
      try {
        return option()
      } catch (_) {}
    }
  }
}

export function firstOptional<T>(...options: Array<() => T>): T | undefined {
  for (let i = 0; i < options.length; i++) {
    let option = options[i]
    try {
      return option()
    } catch (_) {}
  }
}

export function clearRequireCache(): void {
  Object.keys(require.cache).forEach((key) => {
    if (!key.endsWith('.node')) {
      delete require.cache[key]
    }
  })

  Object.keys((Module as any)._pathCache).forEach((key) => {
    delete (Module as any)._pathCache[key]
  })
}

export function withFallback<T>(getter: () => T, fallback: T): T {
  try {
    return getter()
  } catch (e) {
    return fallback
  }
}

export function isObject(value: unknown): boolean {
  return Object.prototype.toString.call(value) === '[object Object]'
}

export function dirContains(dir: string, file: string): boolean {
  let relative = path.relative(dir, file)
  return !!relative && !relative.startsWith('..') && !path.isAbsolute(relative)
}

const WIN_DRIVE_LETTER = /^([a-zA-Z]):/

/**
 * Windows drive letters are case-insensitive and we may get them as either
 * lower or upper case. This function normalizes the drive letter to uppercase
 * to be consistent with the rest of the codebase.
 */
export function normalizeDriveLetter(filepath: string) {
  return filepath.replace(WIN_DRIVE_LETTER, (_, letter) => letter.toUpperCase() + ':')
}

export function changeAffectsFile(change: string, files: Iterable<string>): boolean {
  for (let file of files) {
    if (change === file || dirContains(change, file)) {
      return true
    }
  }
  return false
}

export function normalizePath(originalPath: string) {
  let normalized = normalizePathBase(originalPath)

  // This is Windows network share but the normalize path had one of the leading
  // slashes stripped so we need to add it back
  if (
    originalPath.startsWith('\\\\') &&
    normalized.startsWith('/') &&
    !normalized.startsWith('//')
  ) {
    return `/${normalized}`
  }

  return normalized
}

export function pathToFileURL(filepath: string) {
  try {
    return pathToFileURLBase(filepath)
  } catch (err) {
    if (process.platform !== 'win32') throw err

    // If `pathToFileURL` failsed on windows it's probably because the path was
    // a windows network share path and there were mixed slashes.
    // Fix the path and try again.
    filepath = URI.file(filepath).fsPath

    return pathToFileURLBase(filepath)
  }
}
