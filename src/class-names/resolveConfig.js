import resolveFrom from 'resolve-from'
import importFrom from 'import-from'
import * as path from 'path'
import clearModule from 'clear-module'

export default function resolveConfig({ cwd, config }) {
  const tailwindBase = path.dirname(
    resolveFrom(cwd, 'tailwindcss/package.json')
  )
  let resolve = (x) => x

  if (typeof config === 'string') {
    if (!cwd) {
      cwd = path.dirname(config)
    }
    clearModule(config)
    config = __non_webpack_require__(config)
  }

  try {
    resolve = importFrom(tailwindBase, './resolveConfig.js')
  } catch (_) {
    try {
      const resolveConfig = importFrom(
        tailwindBase,
        './lib/util/resolveConfig.js'
      )
      const defaultConfig = importFrom(
        tailwindBase,
        './stubs/defaultConfig.stub.js'
      )
      resolve = (config) => resolveConfig([config, defaultConfig])
    } catch (_) {
      try {
        const resolveConfig = importFrom(
          tailwindBase,
          './lib/util/mergeConfigWithDefaults.js'
        ).default
        const defaultConfig = importFrom(tailwindBase, './defaultConfig.js')()
        resolve = (config) => resolveConfig(config, defaultConfig)
      } catch (_) {}
    }
  }

  return resolve(config)
}
