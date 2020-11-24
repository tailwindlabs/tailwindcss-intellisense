import * as path from 'path'
import Module from 'module'
import findUp from 'find-up'
import resolveFrom from 'resolve-from'
import importFrom from 'import-from'

export function withUserEnvironment(base, cb) {
  const pnpPath = findUp.sync('.pnp.js', { cwd: base })
  if (pnpPath) {
    return withPnpEnvironment(pnpPath, cb)
  }
  return withNonPnpEnvironment(base, cb)
}

function withPnpEnvironment(pnpPath, cb) {
  const basePath = path.dirname(pnpPath)

  // pnp will patch `module` and `fs` to load package in pnp environment
  // backup the functions which will be patched here
  const originalModule = Object.create(null)
  originalModule._load = Module._load
  originalModule._resolveFilename = Module._resolveFilename
  originalModule._findPath = Module._findPath

  const pnpapi = __non_webpack_require__(pnpPath)

  // get into pnp environment
  pnpapi.setup()

  // restore the patched function, we can not load any package after called this
  const restore = () => Object.assign(Module, originalModule)

  const pnpResolve = (request, from = basePath) => {
    return pnpapi.resolveRequest(request, from + '/')
  }

  const pnpRequire = (request, from) => {
    return __non_webpack_require__(pnpResolve(request, from))
  }

  const res = cb({ resolve: pnpResolve, require: pnpRequire })

  // check if it return a thenable
  if (res != null && res.then) {
    return res.then(
      (x) => {
        restore()
        return x
      },
      (err) => {
        restore()
        throw err
      }
    )
  }

  restore()

  return res
}

function withNonPnpEnvironment(base, cb) {
  return cb({
    require(request, from = base) {
      return importFrom(from, request)
    },
    resolve(request, from = base) {
      return resolveFrom(from, request)
    },
  })
}
