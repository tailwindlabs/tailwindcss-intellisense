import * as path from 'path'
import stackTrace from 'stack-trace'
import pkgUp from 'pkg-up'
import { isObject } from './isObject'
import normalizePath from 'normalize-path'
import { withUserEnvironment } from './environment'

export async function getBuiltInPlugins({ cwd, resolvedConfig }) {
  return withUserEnvironment(cwd, ({ require, resolve }) => {
    const tailwindBase = path.dirname(resolve('tailwindcss/package.json'))
    try {
      return require('./lib/corePlugins.js', tailwindBase).default({
        corePlugins: resolvedConfig.corePlugins,
      })
    } catch (_) {
      return []
    }
  })
}

export default function getPlugins(config) {
  let plugins = config.plugins

  if (!Array.isArray(plugins)) {
    return []
  }

  return plugins.map((plugin) => {
    let pluginConfig = isObject(plugin.config) ? plugin.config : {}

    let contributes = {
      theme: isObject(pluginConfig.theme)
        ? Object.keys(pluginConfig.theme)
        : [],
      variants: isObject(pluginConfig.variants)
        ? Object.keys(pluginConfig.variants)
        : [],
    }

    const handler =
      typeof plugin.handler === 'function' ? plugin.handler : plugin
    const handlerName =
      typeof handler.name === 'string' &&
      handler.name !== 'handler' &&
      handler.name !== ''
        ? handler.name
        : null

    try {
      handler()
    } catch (e) {
      const trace = stackTrace.parse(e)
      if (trace.length === 0) {
        return {
          name: handlerName,
        }
      }
      const file = trace[0].fileName
      if (!/node_modules/.test(file)) {
        return {
          name: handlerName,
        }
      }
      let pkg = pkgUp.sync({ cwd: path.dirname(file) })
      if (!pkg) {
        return {
          name: handlerName,
        }
      }
      try {
        pkg = __non_webpack_require__(pkg)
      } catch (_) {
        return {
          name: handlerName,
        }
      }
      if (pkg.name) {
        if (
          pkg.name === 'tailwindcss' &&
          /node_modules\/tailwindcss\/lib\/plugins\/container\.js$/.test(
            normalizePath(file)
          )
        ) {
          return {
            name: 'tailwindcss/plugins/container',
            description:
              "A component for fixing an element's width to the current breakpoint.",
            homepage: 'https://tailwindcss-v0.netlify.app/docs/container/',
            version: pkg.version,
          }
        }
        return {
          name: pkg.name,
          description: pkg.description,
          homepage: pkg.homepage,
          version: pkg.version,
          contributes,
        }
      }
    }
    return {
      name: handlerName,
    }
  })
}
