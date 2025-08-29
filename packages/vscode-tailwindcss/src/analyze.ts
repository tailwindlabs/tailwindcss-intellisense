import { workspace, RelativePattern, CancellationToken, Uri, WorkspaceFolder } from 'vscode'
import braces from 'braces'
import { CONFIG_GLOB, CSS_GLOB } from '@tailwindcss/language-server/src/lib/constants'
import { getExcludePatterns } from './exclusions'
import * as fs from 'fs'
import * as path from 'path'

interface WorkspaceScanCache {
  folders: string[]
  configFiles: string[]
  tailwindFiles: string[]
  timestamp: number
  settings: Record<string, any>
}

const CACHE_DURATION = 30000 // 30 seconds
let workspaceScanCache: WorkspaceScanCache | null = null

interface FileAnalysisCache {
  [filePath: string]: {
    isTailwindRelated: boolean
    mtime: number
    size: number
    timestamp: number
  }
}

const FILE_CACHE_DURATION = 60000 // 1 minute for file analysis cache
let fileAnalysisCache: FileAnalysisCache = {}

export interface SearchOptions {
  folders: readonly WorkspaceFolder[]
  token: CancellationToken
}

function isCacheValid(cache: WorkspaceScanCache, folders: readonly WorkspaceFolder[]): boolean {
  if (!cache || Date.now() - cache.timestamp > CACHE_DURATION) {
    return false
  }

  // Check if folder paths have changed
  const currentFolders = folders.map((f) => f.uri.fsPath).sort()
  if (JSON.stringify(currentFolders) !== JSON.stringify(cache.folders)) {
    return false
  }

  // Check if settings have changed
  for (let folder of folders) {
    let settings = workspace.getConfiguration('tailwindCSS', folder)
    let configFilePath = settings.get('experimental.configFile')
    let cacheKey = folder.uri.fsPath

    if (JSON.stringify(configFilePath) !== JSON.stringify(cache.settings[cacheKey])) {
      return false
    }
  }

  return true
}

export async function anyWorkspaceFoldersNeedServer({ folders, token }: SearchOptions) {
  // Check cache first
  if (workspaceScanCache && isCacheValid(workspaceScanCache, folders)) {
    return workspaceScanCache.configFiles.length > 0 || workspaceScanCache.tailwindFiles.length > 0
  }

  // An explicit config file setting means we need the server
  const settings: Record<string, any> = {}
  for (let folder of folders) {
    let folderSettings = workspace.getConfiguration('tailwindCSS', folder)
    let configFilePath = folderSettings.get('experimental.configFile')
    settings[folder.uri.fsPath] = configFilePath

    // No setting provided
    if (!configFilePath) continue

    // Ths config file may be a string:
    // A path pointing to a CSS or JS config file
    if (typeof configFilePath === 'string') {
      // Update cache and return
      workspaceScanCache = {
        folders: folders.map((f) => f.uri.fsPath).sort(),
        configFiles: [configFilePath],
        tailwindFiles: [],
        timestamp: Date.now(),
        settings,
      }
      return true
    }

    // Ths config file may be an object:
    // A map of config files to one or more globs
    //
    // If we get an empty object the language server will do a search anyway so
    // we'll act as if no option was passed to be consistent
    if (typeof configFilePath === 'object' && Object.values(configFilePath).length > 0) {
      workspaceScanCache = {
        folders: folders.map((f) => f.uri.fsPath).sort(),
        configFiles: Object.keys(configFilePath),
        tailwindFiles: [],
        timestamp: Date.now(),
        settings,
      }
      return true
    }
  }

  // Check performance setting to limit scan scope
  const performanceSettings = workspace.getConfiguration('tailwindCSS.performance')
  const maxScanFiles = performanceSettings.get('maxScanFiles', 1000)
  const scanTimeout = performanceSettings.get('scanTimeout', 5000)

  let configs: Array<() => Thenable<Uri[]>> = []
  let stylesheets: Array<() => Thenable<Uri[]>> = []

  for (let folder of folders) {
    let exclusions = getExcludePatterns(folder).flatMap((pattern) => braces.expand(pattern))
    let exclude = `{${exclusions.join(',').replace(/{/g, '%7B').replace(/}/g, '%7D')}}`

    configs.push(() =>
      workspace.findFiles(
        new RelativePattern(folder, `**/${CONFIG_GLOB}`),
        exclude,
        maxScanFiles,
        token,
      ),
    )

    stylesheets.push(() =>
      workspace.findFiles(
        new RelativePattern(folder, `**/${CSS_GLOB}`),
        exclude,
        maxScanFiles,
        token,
      ),
    )
  }

  // Add timeout to prevent long scans
  const scanPromise = async () => {
    // If we find a config file then we need the server
    let configUrls = await Promise.all(configs.map((fn) => fn()))
    const configFiles: string[] = []
    for (let group of configUrls) {
      configFiles.push(...group.map((uri) => uri.fsPath))
      if (group.length > 0) {
        workspaceScanCache = {
          folders: folders.map((f) => f.uri.fsPath).sort(),
          configFiles,
          tailwindFiles: [],
          timestamp: Date.now(),
          settings,
        }
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
    const tailwindFiles: string[] = []

    for (let group of stylesheetUrls) {
      for (let file of group) {
        if (await fileMayBeTailwindRelated(file)) {
          tailwindFiles.push(file.fsPath)
          workspaceScanCache = {
            folders: folders.map((f) => f.uri.fsPath).sort(),
            configFiles,
            tailwindFiles,
            timestamp: Date.now(),
            settings,
          }
          return true
        }
      }
    }

    // Cache negative result too
    workspaceScanCache = {
      folders: folders.map((f) => f.uri.fsPath).sort(),
      configFiles,
      tailwindFiles,
      timestamp: Date.now(),
      settings,
    }
    return false
  }

  // Race scan promise with timeout
  const timeoutPromise = new Promise<boolean>((resolve) => {
    setTimeout(() => resolve(false), scanTimeout)
  })

  return Promise.race([scanPromise(), timeoutPromise])
}

let HAS_CONFIG = /@config\s*['"]/
let HAS_IMPORT = /@import\s*['"]/
let HAS_TAILWIND = /@tailwind\s*[^;]+;/
let HAS_THEME = /@theme\s*\{/

export async function fileMayBeTailwindRelated(uri: Uri): Promise<boolean> {
  const filePath = uri.fsPath
  const now = Date.now()

  try {
    // Get file stats for cache validation
    const stat = await workspace.fs.stat(uri)
    const mtime = stat.mtime
    const size = stat.size

    // Check cache first
    const cached = fileAnalysisCache[filePath]
    if (
      cached &&
      cached.mtime === mtime &&
      cached.size === size &&
      now - cached.timestamp < FILE_CACHE_DURATION
    ) {
      return cached.isTailwindRelated
    }

    // Performance optimization: Skip very large files (likely not Tailwind CSS)
    if (size > 1024 * 1024) {
      // 1MB
      const result = false
      fileAnalysisCache[filePath] = {
        isTailwindRelated: result,
        mtime,
        size,
        timestamp: now,
      }
      return result
    }

    // Read and analyze file
    const buffer = await workspace.fs.readFile(uri)
    const contents = buffer.toString()

    // Early exit optimizations
    if (contents.length === 0) {
      const result = false
      fileAnalysisCache[filePath] = {
        isTailwindRelated: result,
        mtime,
        size,
        timestamp: now,
      }
      return result
    }

    // Quick check for obvious Tailwind indicators first (most common)
    const isTailwindRelated =
      HAS_TAILWIND.test(contents) ||
      HAS_CONFIG.test(contents) ||
      HAS_IMPORT.test(contents) ||
      HAS_THEME.test(contents)

    // Cache the result
    fileAnalysisCache[filePath] = {
      isTailwindRelated,
      mtime,
      size,
      timestamp: now,
    }

    return isTailwindRelated
  } catch (error) {
    // If we can't read the file, assume it's not Tailwind-related
    console.warn(`Failed to analyze file ${filePath}:`, error)
    return false
  }
}

// Clean up file analysis cache periodically
function cleanupFileAnalysisCache() {
  const now = Date.now()
  const keysToDelete: string[] = []

  for (const [filePath, cached] of Object.entries(fileAnalysisCache)) {
    if (now - cached.timestamp > FILE_CACHE_DURATION) {
      keysToDelete.push(filePath)
    }
  }

  for (const key of keysToDelete) {
    delete fileAnalysisCache[key]
  }

  if (keysToDelete.length > 0) {
    console.log(`[Cache] Cleaned ${keysToDelete.length} expired file analysis entries`)
  }
}

// Start cleanup interval
setInterval(cleanupFileAnalysisCache, FILE_CACHE_DURATION)
