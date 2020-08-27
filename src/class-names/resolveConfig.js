import * as path from 'path'
import decache from './decache'
import { withUserEnvironment } from './environment'

export default function resolveConfig({ cwd, config }) {
  if (typeof config === 'string') {
    if (!cwd) {
      cwd = path.dirname(config)
    }
    decache(config)
    config = __non_webpack_require__(config)
  }

  let resolve = (x) => x
  withUserEnvironment(cwd, ({ require, resolve }) => {
    const tailwindBase = path.dirname(resolve('tailwindcss/package.json'))
    try {
      resolve = require('./resolveConfig.js', tailwindBase)
    } catch (_) {
      try {
        const resolveConfig = require('./lib/util/resolveConfig.js', tailwindBase)
        const defaultConfig = require('./stubs/defaultConfig.stub.js', tailwindBase)
        resolve = (config) => resolveConfig([config, defaultConfig])
      } catch (_) {}
    }
  })

  return resolve(config)
}
