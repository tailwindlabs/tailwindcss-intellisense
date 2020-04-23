import semver from 'semver'
import dlv from 'dlv'

export default function getVariants({ config, version, postcss }) {
  let variants = ['responsive', 'hover']
  semver.gte(version, '0.3.0') && variants.push('focus', 'group-hover')
  semver.gte(version, '0.5.0') && variants.push('active')
  semver.gte(version, '0.7.0') && variants.push('focus-within')
  semver.gte(version, '1.0.0-beta.1') && variants.push('default')
  semver.gte(version, '1.1.0') &&
    variants.push('first', 'last', 'odd', 'even', 'disabled', 'visited')

  let plugins = config.plugins
  if (!Array.isArray(plugins)) {
    plugins = []
  }
  plugins.forEach((plugin) => {
    try {
      ;(plugin.handler || plugin)({
        addUtilities: () => {},
        addComponents: () => {},
        addBase: () => {},
        addVariant: (name) => {
          variants.push(name)
        },
        e: (x) => x,
        prefix: (x) => x,
        theme: (path, defaultValue) =>
          dlv(config, `theme.${path}`, defaultValue),
        variants: () => [],
        config: (path, defaultValue) => dlv(config, path, defaultValue),
        postcss,
      })
    } catch (_) {}
  })

  return variants
}
