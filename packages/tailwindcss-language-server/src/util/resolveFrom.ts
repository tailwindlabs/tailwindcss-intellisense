import { equal } from '@tailwindcss/language-service/src/util/array'
import * as path from 'node:path'
import { createResolver } from './resolve'

let pnpApi: any
let extensions = Object.keys(require.extensions)

function recreateResolver() {
  return createResolver({ extensions, pnpApi })
}

let resolver = recreateResolver()

export function setPnpApi(newPnpApi: any): void {
  pnpApi = newPnpApi
  resolver = recreateResolver()
}

export default function resolveFrom(from?: string, id?: string): string {
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
