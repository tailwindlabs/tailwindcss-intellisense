import Module from 'module'
import * as path from 'path'
import resolveFrom from '../util/resolveFrom'
import builtInModules from 'builtin-modules'

process.env.TAILWIND_MODE = 'build'
process.env.TAILWIND_DISABLE_TOUCH = 'true'

let oldResolveFilename = (Module as any)._resolveFilename

;(Module as any)._resolveFilename = (id: any, parent: any) => {
  if (builtInModules.includes(id)) {
    return oldResolveFilename(id, parent)
  }
  return resolveFrom(path.dirname(parent.id), id)
}
