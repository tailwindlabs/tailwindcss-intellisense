import * as path from 'path'
import clearModule from 'clear-module'
import { withUserEnvironment } from './environment'

export default function resolveConfig({ cwd, config }) {
  if (typeof config === 'string') {
    if (!cwd) {
      cwd = path.dirname(config)
    }
    clearModule(config)
    config = __non_webpack_require__(config)
  }

  return withUserEnvironment(cwd, ({ require, resolve }) => {
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
