import { fdir } from 'fdir'

interface SearchFilesOptions {
  /** The directory to search in */
  root: string

  /** A list of patterns to include */
  include: string[]

  /** A list of patterns to exclude */
  exclude: string[]

  /**
   * Control whether or not an entry should be yielded or traversed
   */
  filterEntry?(path: string, isDirectory: boolean): boolean
}

export function searchFiles(opts: SearchFilesOptions) {
  return new fdir({
    // onlyFiles: true
    includeDirs: false,
    excludeFiles: false,

    // absolute: true
    relativePaths: false,
    resolvePaths: true,
    includeBasePath: true,

    // followSymbolicLinks: true
    resolveSymlinks: true,
    excludeSymlinks: false,

    //
    suppressErrors: true,

    // Normalize Windows paths to use forward slashes
    pathSeparator: '/',

    filters: [(path, isDirectory) => opts.filterEntry?.(path, isDirectory) ?? true],

    exclude: (name, path) => false,
  })
    .crawl(opts.root)
    .withPromise()
}
