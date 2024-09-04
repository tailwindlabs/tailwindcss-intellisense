import Module from 'node:module'
import * as path from 'node:path'
import { resolveFrom } from '../util/resolveFrom'

process.env.TAILWIND_MODE = 'build'
process.env.TAILWIND_DISABLE_TOUCH = 'true'

let oldResolveFilename = (Module as any)._resolveFilename

function isBuiltin(id: string) {
  // Node 16.17+, v18.6.0+, >= v20
  // VSCode >= 1.78
  if ('isBuiltin' in Module) {
    return Module.isBuiltin(id)
  }

  // Older versions of Node and VSCode
  // @ts-ignore
  return Module.builtinModules.includes(id.replace(/^node:/, ''))
}

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
