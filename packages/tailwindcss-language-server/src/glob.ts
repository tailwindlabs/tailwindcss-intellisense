import { fdir } from 'fdir'
import picomatch from 'picomatch'

interface SearchFilesOptions {
  /** The directory to search in */
  root: string

  /** The maximum time to wait for the search to complete */
  timeout: number

  /** A list of patterns to include */
  include: string[]

  /** A list of patterns to exclude */
  exclude: string[]
}

export async function searchFiles(opts: SearchFilesOptions) {
  // Ignore patterns in the project search are generally intended to match
  // directories but _may_ also match files.
  //
  // A pattern like `**/node_modules` should match like these:
  // - `**/node_modules/` to exclude directories from traversal
  // - `**/node_modules/**/*` to exclude files from results
  //
  // This approximately matches how fast-glob's `ignore` option works.
  let shouldIgnore = picomatch(
    [...new Set(opts.exclude.flatMap((x) => [x, `${x}/`, `${x}/**/*`]))],
    { dot: true },
  )

  let controller = new AbortController()
  let timer = setTimeout(() => controller.abort(), opts.timeout)

  let crawler = new fdir({
    // Let us cancel the search if it takes too long
    signal: controller.signal,

    // onlyFiles: true
    includeDirs: false,
    excludeFiles: false,

    // absolute: true
    relativePaths: false,
    resolvePaths: false,
    includeBasePath: true,

    // followSymbolicLinks: true
    resolveSymlinks: false,
    excludeSymlinks: false,

    //
    suppressErrors: true,

    // Normalize Windows paths to use forward slashes
    pathSeparator: '/',

    // Don't return files that are ignored
    filters: [(path) => !shouldIgnore(path)],

    // Don't traverse into directories that are ignored
    exclude: (_, path) => shouldIgnore(path),

    globFunction: picomatch,
  })

  crawler = crawler.globWithOptions(opts.include, { dot: true })

  let results = await crawler.crawl(opts.root).withPromise()

  clearTimeout(timer)

  return results
}
