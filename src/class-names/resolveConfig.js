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
  withUserEnvironment(cwd, ({ require }) => {
    try {
      resolve = require('tailwindcss/resolveConfig.js')
    } catch (_) {
      try {
        const resolveConfig = require('tailwindcss/lib/util/resolveConfig.js')
        const defaultConfig = require('tailwindcss/stubs/defaultConfig.stub.js')
        resolve = (config) => resolveConfig([config, defaultConfig])
      } catch (_) {}
    }
  })

  return resolve(config)
}
