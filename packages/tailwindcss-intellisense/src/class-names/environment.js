import * as path from 'path'
import findUp from 'find-up'
import resolveFrom from 'resolve-from'
import importFrom from 'import-from'

let isPnp
let pnpApi

export function withUserEnvironment(base, root, cb) {
  if (isPnp === true) {
    return withPnpEnvironment(base, cb)
  }

  if (isPnp === false) {
    return withNonPnpEnvironment(base, cb)
  }

  const pnpPath = findUp.sync(
    (dir) => {
      let pnpFile = path.join(dir, '.pnp.js')
      if (findUp.sync.exists(pnpFile)) {
        return pnpFile
      }
      pnpFile = path.join(dir, '.pnp.cjs')
      if (findUp.sync.exists(pnpFile)) {
        return pnpFile
      }
      if (dir === root) {
        return findUp.stop
      }
    },
    { cwd: base }
  )

  if (pnpPath) {
    isPnp = true
    pnpApi = __non_webpack_require__(pnpPath)
    pnpApi.setup()
  } else {
    isPnp = false
  }

  return withUserEnvironment(base, root, cb)
}

function withPnpEnvironment(base, cb) {
  const pnpResolve = (request, from = base) => {
    return pnpApi.resolveRequest(request, from.replace(/\/$/, '') + '/')
  }

  const pnpRequire = (request, from) => {
    return __non_webpack_require__(pnpResolve(request, from))
  }

  const res = cb({ isPnp: true, resolve: pnpResolve, require: pnpRequire })

  // check if it return a thenable
  if (res != null && res.then) {
    return res.then(
      (x) => {
        return x
      },
      (err) => {
        throw err
      }
    )
  }

  return res
}

function withNonPnpEnvironment(base, cb) {
  return cb({
    isPnp: false,
    require(request, from = base) {
      return importFrom(from, request)
    },
    resolve(request, from = base) {
      return resolveFrom(from, request)
    },
  })
}
