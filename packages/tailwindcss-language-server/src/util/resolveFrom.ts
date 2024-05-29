import { equal } from '@tailwindcss/language-service/src/util/array'
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
  if (id.startsWith('\\\\')) return id

  let newExtensions = Object.keys(require.extensions)
  if (!equal(newExtensions, extensions)) {
    extensions = newExtensions
    resolver = recreateResolver()
  }

  let result = resolver.resolveSync({}, from, id)
  if (result === false) throw Error()
  return result
}
