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

export async function getUtilityConfigMap({ cwd, resolvedConfig, postcss }) {
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
        config: proxiedConfig,
        addUtilities: (utilities) => {
          ;(Array.isArray(utilities) ? utilities : [utilities]).forEach(
            (utils) => {
              Object.keys(utils).forEach((util) => {
                if (!/^\.[^\s]+$/.test(util)) {
                  return
                }
                let props = Object.keys(utils[util])
                let values = props.map((prop) => utils[util][prop])
                if (values.some((val) => typeof val !== 'string')) {
                  return
                }
                let deps = values
                  .filter((val) => val.substr(0, 5) === '$dep$')
                  // unique
                  .filter((val, index, self) => self.indexOf(val) === index)
                  .map((dep) => dep.substr(5))
                if (deps.length === 1) {
                  let className = util.substr(1)
                  let match = className.match(/[^\\]::?/)
                  if (match !== null) {
                    className = className.substr(0, match.index + 1)
                  }
                  classNameConfigMap[className] = deps[0]
                }
              })
            }
          )
        },
      })
    })

    return classNameConfigMap
  } catch (_) {
    return {}
  }
}
