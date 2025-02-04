import findUp from 'find-up'
import * as path from 'node:path'
import { pathToFileURL } from '../utils'

export interface PnpApi {
  resolveToUnqualified: (arg0: string, arg1: string, arg2: object) => null | string
}

const cache = new Map<string, PnpApi | null>()

/**
 * Loads the PnP API from the given directory if found.
 * We intentionally do not call `setup` to monkey patch global APIs
 * TODO: Verify that we can get by without doing this
 */
export async function loadPnPApi(root: string): Promise<PnpApi | null> {
  let existing = cache.get(root)
  if (existing !== undefined) {
    return existing
  }

  let pnpPath = await findPnPApi(path.normalize(root))
  if (!pnpPath) {
    cache.set(root, null)
    return null
  }

  let pnpUrl = pathToFileURL(pnpPath).href
  let mod = await import(pnpUrl)
  let api = mod.default
  api.setup()
  cache.set(root, api)
  return api
}

/**
 * Locates the PnP API file for a given directory
 */
async function findPnPApi(root: string): Promise<string | null> {
  let names = ['.pnp.js', '.pnp.cjs']

  for (let name of names) {
    let filepath = path.join(root, name)

    if (await findUp.exists(filepath)) {
      return filepath
    }
  }

  return null
}
