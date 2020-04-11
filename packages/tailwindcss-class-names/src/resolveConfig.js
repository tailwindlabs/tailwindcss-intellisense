import importFrom from 'import-from'
import * as path from 'path'

export default function resolveConfig({ cwd, config }) {
  let resolve = x => x

  if (typeof config === 'string') {
    if (!cwd) {
      cwd = path.dirname(config)
    }
    config = __non_webpack_require__(config)
  }

  try {
    resolve = importFrom(cwd, 'tailwindcss/resolveConfig.js')
  } catch (_) {
    try {
      const resolveConfig = importFrom(
        cwd,
        'tailwindcss/lib/util/resolveConfig.js'
      )
      const defaultConfig = importFrom(
        cwd,
        'tailwindcss/stubs/defaultConfig.stub.js'
      )
      resolve = config => resolveConfig([config, defaultConfig])
    } catch (_) {}
  }

  return resolve(config)
}
