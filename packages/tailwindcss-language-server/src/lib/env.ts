import Module from 'module'
import * as path from 'path'
import resolveFrom from '../util/resolveFrom'
import {builtinModules} from 'module'

process.env.TAILWIND_MODE = 'build'
process.env.TAILWIND_DISABLE_TOUCH = 'true'

let oldResolveFilename = (Module as any)._resolveFilename
const nodeModulePrefix = /^node:/i;

;(Module as any)._resolveFilename = (id: any, parent: any) => {
  if (typeof id === 'string' && builtinModules.includes(id.replace(nodeModulePrefix, ''))) {
    return oldResolveFilename(id, parent)
  }

  if (parent) {
    return resolveFrom(path.dirname(parent.id), id)
  }

  // console.log(`Resolving w/o parent ${id}`)

  return resolveFrom(process.cwd(), id)
}
