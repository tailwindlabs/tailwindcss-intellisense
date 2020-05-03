/**
 * Adapted from: https://github.com/elastic/require-in-the-middle
 */
import Module from 'module'

export default function Hook(find, onrequire) {
  if (!(this instanceof Hook)) return new Hook(find, onrequire)

  if (typeof Module._resolveFilename !== 'function') {
    throw new Error(
      `Error: Expected Module._resolveFilename to be a function (was: ${typeof Module._resolveFilename}) - aborting!`
    )
  }

  this.cache = {}
  this.deps = []
  this._unhooked = false
  this._origRequire = Module.prototype.require

  let self = this
  let patching = {}

  this._require = Module.prototype.require = function(request) {
    if (self._unhooked) {
      // if the patched require function could not be removed because
      // someone else patched it after it was patched here, we just
      // abort and pass the request onwards to the original require
      return self._origRequire.apply(this, arguments)
    }

    let filename = Module._resolveFilename(request, this)

    // return known patched modules immediately
    if (self.cache.hasOwnProperty(filename)) {
      return self.cache[filename]
    }

    // Check if this module has a patcher in-progress already.
    // Otherwise, mark this module as patching in-progress.
    let patched = patching[filename]
    if (!patched) {
      patching[filename] = true
    }

    let exports = self._origRequire.apply(this, arguments)

    if (filename !== find) {
      if (self._watching) {
        self.deps.push(filename)
      }
      return exports
    }

    // If it's already patched, just return it as-is.
    if (patched) return exports

    // The module has already been loaded,
    // so the patching mark can be cleaned up.
    delete patching[filename]

    // only call onrequire the first time a module is loaded
    if (!self.cache.hasOwnProperty(filename)) {
      // ensure that the cache entry is assigned a value before calling
      // onrequire, in case calling onrequire requires the same module.
      self.cache[filename] = exports
      self.cache[filename] = onrequire(exports)
    }

    return self.cache[filename]
  }
}

Hook.prototype.unhook = function() {
  this._unhooked = true
  if (this._require === Module.prototype.require) {
    Module.prototype.require = this._origRequire
  }
}

Hook.prototype.watch = function() {
  this._watching = true
}

Hook.prototype.unwatch = function() {
  this._watching = false
}
