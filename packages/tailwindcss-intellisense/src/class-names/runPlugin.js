import dlv from 'dlv'

export function runPlugin(plugin, params = {}) {
  const { config, browserslist, ...rest } = params

  const browserslistTarget =
    browserslist && browserslist.includes('ie 11') ? 'ie11' : 'relaxed'

  try {
    ;(plugin.handler || plugin)({
      addUtilities: () => {},
      addComponents: () => {},
      addBase: () => {},
      addVariant: () => {},
      e: (x) => x,
      prefix: (x) => x,
      theme: (path, defaultValue) => dlv(config, `theme.${path}`, defaultValue),
      variants: () => [],
      config: (path, defaultValue) => dlv(config, path, defaultValue),
      corePlugins: (path) => {
        if (Array.isArray(config.corePlugins)) {
          return config.corePlugins.includes(path)
        }
        return dlv(config, `corePlugins.${path}`, true)
      },
      target: (path) => {
        if (typeof config.target === 'string') {
          return config.target === 'browserslist'
            ? browserslistTarget
            : config.target
        }
        const [defaultTarget, targetOverrides] = dlv(config, 'target')
        const target = dlv(targetOverrides, path, defaultTarget)
        return target === 'browserslist' ? browserslistTarget : target
      },
      ...rest,
    })
  } catch (_) {}
}
