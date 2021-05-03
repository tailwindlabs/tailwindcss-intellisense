import * as fs from 'fs'
import { CachedInputFileSystem, ResolverFactory, Resolver, ResolveOptions } from 'enhanced-resolve'

function createResolver(options: Partial<ResolveOptions> = {}): Resolver {
  return ResolverFactory.createResolver({
    fileSystem: new CachedInputFileSystem(fs, 4000),
    useSyncFileSystemCalls: true,
    // cachePredicate: () => false,
    exportsFields: [],
    conditionNames: ['node'],
    extensions: ['.js', '.json', '.node'],
    ...options,
  })
}

let resolver = createResolver()

export function setPnpApi(pnpApi: any): void {
  resolver = createResolver({ pnpApi })
}

export default function resolveFrom(from?: string, id?: string): string {
  let result = resolver.resolveSync({}, from, id)
  if (result === false) throw Error()
  return result
}
