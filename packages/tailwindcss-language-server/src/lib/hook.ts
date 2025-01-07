/**
 * Adapted from: https://github.com/elastic/require-in-the-middle
 */
import Module from 'node:module'
import plugins from './plugins'

let bundledModules = {
  ...plugins,
  'tailwindcss/colors': require('tailwindcss/colors'),
  'tailwindcss/defaultConfig': require('tailwindcss/defaultConfig'),
  'tailwindcss/defaultTheme': require('tailwindcss/defaultTheme'),
  'tailwindcss/resolveConfig': require('tailwindcss/resolveConfig'),
  'tailwindcss/plugin': require('tailwindcss/plugin'),
}

export default class Hook {
  cache = {}
  deps: string[] = []
  private _unhooked: boolean = false
  private _origRequire = Module.prototype.require
  private _require: (req: string) => any

  constructor(find: string, callback: (x) => {} = (x) => x) {
    // @ts-ignore
    if (typeof Module._resolveFilename !== 'function') {
      throw new Error(
        // @ts-ignore
        `Error: Expected Module._resolveFilename to be a function (was: ${typeof Module._resolveFilename}) - aborting!`,
      )
    }

    let self = this
    let patching = {}

    // @ts-ignore
    this._require = Module.prototype.require = function (request) {
      if (self._unhooked) {
        // if the patched require function could not be removed because
        // someone else patched it after it was patched here, we just
        // abort and pass the request onwards to the original require
        return self._origRequire.apply(this, arguments)
      }

      let filename

      if (bundledModules.hasOwnProperty(request)) {
        try {
          // @ts-ignore
          filename = Module._resolveFilename(request, this)
        } catch (_) {
          // if (plugins.hasOwnProperty(request)) {
          //   console.log(`Using bundled version of \`${request}\`: v${plugins[request].version}`)
          // }
          return bundledModules[request].module || bundledModules[request]
        }
      } else {
        // @ts-ignore
        filename = Module._resolveFilename(request, this)
      }

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
        self.cache[filename] = callback(exports)
      }

      return self.cache[filename]
    }
  }

  unhook() {
    this._unhooked = true
    if (this._require === Module.prototype.require) {
      Module.prototype.require = this._origRequire
    }
  }
}
