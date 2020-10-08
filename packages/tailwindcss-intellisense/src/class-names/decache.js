import * as path from 'path' // if module is locally defined we path.resolve it
import callsite from 'callsite'
import Module from 'module'

function find(moduleName) {
  if (moduleName[0] === '.') {
    var stack = callsite()
    for (var i in stack) {
      var filename = stack[i].getFileName()
      // if (filename !== module.filename) {
      moduleName = path.resolve(path.dirname(filename), moduleName)
      break
      // }
    }
  }
  try {
    return __non_webpack_require__.resolve(moduleName)
  } catch (e) {
    return
  }
}

/**
 * Removes a module from the cache. We need this to re-load our http_request !
 * see: http://stackoverflow.com/a/14801711/1148249
 */
function decache(moduleName) {
  moduleName = find(moduleName)

  if (!moduleName) {
    return
  }

  // Run over the cache looking for the files
  // loaded by the specified module name
  searchCache(moduleName, function(mod) {
    delete __non_webpack_require__.cache[mod.id]
  })

  // Remove cached paths to the module.
  // Thanks to @bentael for pointing this out.
  Object.keys(Module.prototype.constructor._pathCache).forEach(function(
    cacheKey
  ) {
    if (cacheKey.indexOf(moduleName) > -1) {
      delete Module.prototype.constructor._pathCache[cacheKey]
    }
  })
}

/**
 * Runs over the cache to search for all the cached
 * files
 */
function searchCache(moduleName, callback) {
  // Resolve the module identified by the specified name
  var mod = __non_webpack_require__.resolve(moduleName)
  var visited = {}

  // Check if the module has been resolved and found within
  // the cache no else so #ignore else http://git.io/vtgMI
  /* istanbul ignore else */
  if (mod && (mod = __non_webpack_require__.cache[mod]) !== undefined) {
    // Recursively go over the results
    ;(function run(current) {
      visited[current.id] = true
      // Go over each of the module's children and
      // run over it
      current.children.forEach(function(child) {
        // ignore .node files, decachine native modules throws a
        // "module did not self-register" error on second require
        if (path.extname(child.filename) !== '.node' && !visited[child.id]) {
          run(child)
        }
      })

      // Call the specified callback providing the
      // found module
      callback(current)
    })(mod)
  }
}

export default decache
