import * as fs from 'node:fs'
import * as path from 'node:path'
import { equal } from '@tailwindcss/language-service/src/util/array'
import { CachedInputFileSystem, ResolverFactory } from 'enhanced-resolve'

let pnpApi: any
let extensions = Object.keys(require.extensions)

function recreateResolver() {
  let fileSystem = new CachedInputFileSystem(fs, 4000)

  return ResolverFactory.createResolver({
    fileSystem,
    useSyncFileSystemCalls: true,
    conditionNames: ['node', 'require'],
    extensions,
    pnpApi,
  })
}

let resolver = recreateResolver()

/**
 * @deprecated Use `createResolver()` instead.
 */
export function setPnpApi(newPnpApi: any): void {
  pnpApi = newPnpApi
  resolver = recreateResolver()
}

/**
 * Resolve a module id from a given path synchronously.
 *
 * This is a legacy API and should be avoided in favor of the async version as
 * it does not support TypeScript path mapping.
 *
 * @deprecated Use `createResolver().resolveJsId(…)` instead.
 */
export function resolveFrom(from?: string, id?: string): string {
  // Network share path on Windows
  if (id.startsWith('\\\\')) return id

  // Normalized network share path on Windows
  if (id.startsWith('//') && path.sep === '\\') return id

  // Normalized network share path on Windows
  if (from.startsWith('//') && path.sep === '\\') {
    from = '\\\\' + from.slice(2)
  }

  let newExtensions = Object.keys(require.extensions)
  if (!equal(newExtensions, extensions)) {
    extensions = newExtensions
    resolver = recreateResolver()
  }

  let result = resolver.resolveSync({}, from, id)
  if (result === false) throw Error()

  // The `enhanced-resolve` package supports resolving paths with fragment
  // identifiers. For example, it can resolve `foo/bar#baz` to `foo/bar.js`
  // However, it's also possible that a path contains a `#` character as part
  // of the path itself. For example, `foo#bar` might point to a file named
  // `foo#bar.js`. The resolver distinguishes between these two cases by
  // escaping the `#` character with a NUL byte when it's part of the path.
  //
  // Since the real path doesn't actually contain NUL bytes, we need to remove
  // them to get the correct path otherwise readFileSync will throw an error.
  result = result.replace(/\0(.)/g, '$1')

  return result
}
