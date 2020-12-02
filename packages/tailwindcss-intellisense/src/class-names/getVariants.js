import semver from 'semver'
import { runPlugin } from './runPlugin'

export default function getVariants({
  config,
  version,
  postcss,
  browserslist,
}) {
  let variants = ['responsive', 'hover']
  semver.gte(version, '0.3.0') && variants.push('focus', 'group-hover')
  semver.gte(version, '0.5.0') && variants.push('active')
  semver.gte(version, '0.7.0') && variants.push('focus-within')
  semver.gte(version, '1.0.0-beta.1') && variants.push('default')
  semver.gte(version, '1.1.0') &&
    variants.push('first', 'last', 'odd', 'even', 'disabled', 'visited')
  semver.gte(version, '1.3.0') && variants.push('group-focus')

  let plugins = Array.isArray(config.plugins) ? config.plugins : []

  plugins.forEach((plugin) => {
    runPlugin(plugin, {
      postcss,
      browserslist,
      config,
      addVariant: (name) => {
        variants.push(name)
      },
    })
  })

  return variants
}
