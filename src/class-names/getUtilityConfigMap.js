import { runPlugin } from './runPlugin'
import { getBuiltInPlugins } from './getPlugins'
import { isObject } from './isObject'

const proxyHandler = (base = []) => ({
  get(target, key) {
    if (isObject(target[key])) {
      return new Proxy(target[key], proxyHandler([...base, key]))
    } else {
      if (
        [...base, key].every((x) => typeof x === 'string') &&
        target.hasOwnProperty(key)
      ) {
        return '$dep$' + [...base, key].join('.')
      }
      return target[key]
    }
  },
})

export async function getUtilityConfigMap({
  cwd,
  resolvedConfig,
  postcss,
  browserslist,
}) {
  const builtInPlugins = await getBuiltInPlugins({ cwd, resolvedConfig })
  const userPlugins = Array.isArray(resolvedConfig.plugins)
    ? resolvedConfig.plugins
    : []

  try {
    const classNameConfigMap = {}
    const proxiedConfig = new Proxy(resolvedConfig, proxyHandler())

    ;[...builtInPlugins, ...userPlugins].forEach((plugin) => {
      runPlugin(plugin, {
        postcss,
        browserslist,
        config: proxiedConfig,
        addUtilities: (utilities) => {
          Object.keys(utilities).forEach((util) => {
            let props = Object.keys(utilities[util])
            if (
              props.length === 1 &&
              /^\.[^\s]+$/.test(util) &&
              typeof utilities[util][props[0]] === 'string' &&
              utilities[util][props[0]].substr(0, 5) === '$dep$'
            ) {
              classNameConfigMap[util.substr(1)] = utilities[util][
                props[0]
              ].substr(5)
            }
          })
        },
      })
    })

    return classNameConfigMap
  } catch (_) {
    return {}
  }
}
