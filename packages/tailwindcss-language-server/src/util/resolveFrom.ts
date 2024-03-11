import * as fs from 'fs'
import {
  CachedInputFileSystem,
  ResolverFactory,
  Resolver,
  ResolveOptions,
} from 'enhanced-resolve-301'
import { equal } from '@tailwindcss/language-service/src/util/array'

let pnpApi: any
let extensions = Object.keys(require.extensions)

function createResolver(options: Partial<ResolveOptions> = {}): Resolver {
  return ResolverFactory.createResolver({
    fileSystem: new CachedInputFileSystem(fs, 4000),
    useSyncFileSystemCalls: true,
    // cachePredicate: () => false,
    conditionNames: ['node', 'require'],
    extensions,
    pnpApi,
    ...options,
  })
}

let resolver = createResolver()

export function setPnpApi(newPnpApi: any): void {
  pnpApi = newPnpApi
  resolver = createResolver()
}

export default function resolveFrom(from?: string, id?: string): string {
  if (id.startsWith('\\\\')) return id

  let newExtensions = Object.keys(require.extensions)
  if (!equal(newExtensions, extensions)) {
    extensions = newExtensions
    resolver = createResolver()
  }

  let result = resolver.resolveSync({}, from, id)
  if (result === false) throw Error()
  // https://github.com/webpack/enhanced-resolve/issues/282
  return result.replace(/\0#/g, '#')
}
