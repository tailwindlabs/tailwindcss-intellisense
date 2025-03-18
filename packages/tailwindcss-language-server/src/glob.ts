import glob from 'fast-glob'
import os from 'node:os'

interface SearchFilesOptions {
  /** The directory to search in */
  root: string

  /** A list of patterns to include */
  include: string[]

  /** A list of patterns to exclude */
  exclude: string[]
}

export async function searchFiles(opts: SearchFilesOptions) {
  let results = await glob(opts.include, {
    cwd: opts.root,
    ignore: opts.exclude,
    onlyFiles: true,
    absolute: true,
    suppressErrors: true,
    dot: true,
    concurrency: Math.max(os.cpus().length, 1),
  })

  return results
}
