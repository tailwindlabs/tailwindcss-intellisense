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
  return result
}
