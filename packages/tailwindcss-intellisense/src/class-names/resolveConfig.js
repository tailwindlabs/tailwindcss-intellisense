import * as path from 'path'
import decache from './decache'
import { withUserEnvironment } from './environment'

export default function resolveConfig({ base, root, config }) {
  if (typeof config === 'string') {
    if (!cwd) {
      cwd = path.dirname(config)
    }
    decache(config)
    config = __non_webpack_require__(config)
  }

  return withUserEnvironment(base, root, ({ require, resolve }) => {
    let resolveConfigFn = (config) => config
    const tailwindBase = path.dirname(resolve('tailwindcss/package.json'))
    try {
      resolveConfigFn = require('./resolveConfig.js', tailwindBase)
    } catch (_) {
      try {
        const resolveConfig = require('./lib/util/resolveConfig.js', tailwindBase)
        const defaultConfig = require('./stubs/defaultConfig.stub.js', tailwindBase)
        resolveConfigFn = (config) => resolveConfig([config, defaultConfig])
      } catch (_) {
        try {
          const resolveConfig = require('./lib/util/mergeConfigWithDefaults.js', tailwindBase)
            .default
          const defaultConfig = require('./defaultConfig.js', tailwindBase)()
          resolveConfigFn = (config) => resolveConfig(config, defaultConfig)
        } catch (_) {}
      }
    }
    return resolveConfigFn(config)
  })
}
