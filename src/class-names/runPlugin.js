import dlv from 'dlv'

export function runPlugin(plugin, params = {}) {
  const { config, ...rest } = params
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
      ...rest,
    })
  } catch (_) {}
}
