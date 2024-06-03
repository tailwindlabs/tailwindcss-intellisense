import Module from 'node:module'
import { isBuiltin } from 'node:module'
import * as path from 'node:path'
import resolveFrom from '../util/resolveFrom'

process.env.TAILWIND_MODE = 'build'
process.env.TAILWIND_DISABLE_TOUCH = 'true'

let oldResolveFilename = (Module as any)._resolveFilename

;(Module as any)._resolveFilename = (id: any, parent: any) => {
  if (typeof id === 'string' && isBuiltin(id)) {
    return oldResolveFilename(id, parent)
  }

  if (parent) {
    return resolveFrom(path.dirname(parent.id), id)
  }

  // console.log(`Resolving w/o parent ${id}`)

  return resolveFrom(process.cwd(), id)
}
