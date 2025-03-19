import * as semver from './util/semver'

export type Feature =
  | 'layer:preflight'
  | 'layer:base'
  | 'css-at-theme'
  | 'css-at-config-as-project'
  | 'transpiled-configs'
  | 'relative-content-paths'
  | 'browserslist-in-plugins'
  | 'apply-complex-classes'
  | 'apply-complex-classes:flagged'
  | 'content-list'
  | 'purge-list'
  | 'jit'
  | 'separator:root'
  | 'separator:options'
  | 'source-not'
  | 'source-inline'

/**
 * Determine a list of features that are supported by the given Tailwind CSS version
 */
export function supportedFeatures(version: string, mod?: unknown): Feature[] {
  let features: Feature[] = []

  let isInsiders = version.startsWith('0.0.0-insiders')
  let isInsidersV3 = false
  let isInsidersV4 = false

  if (isInsiders) {
    if (mod && typeof mod === 'object' && 'compile' in mod) {
      // ESM version for normal installations
      isInsidersV4 = true
    } else if (mod && typeof mod === 'function' && 'compile' in mod) {
      // Common JS version for Yarn PnP support
      isInsidersV4 = true
    } else {
      isInsidersV3 = true
    }
  }

  if (isInsidersV4) {
    return ['css-at-theme', 'layer:base', 'content-list', 'source-inline', 'source-not']
  }

  if (!isInsidersV3) {
    if (semver.gte(version, '4.1.0')) {
      return ['css-at-theme', 'layer:base', 'content-list', 'source-inline', 'source-not']
    }

    if (semver.gte(version, '4.0.0-alpha.1')) {
      return ['css-at-theme', 'layer:base', 'content-list']
    }

    if (version.startsWith('0.0.0-oxide')) {
      return ['css-at-theme', 'layer:base', 'content-list']
    }
  }

  if (semver.gte(version, '0.99.0')) {
    // `@tailwind base`` (and `@layer base`)
    features.push('layer:base')

    // `separator` key at the root of the config
    features.push('separator:root')
  } else {
    // `@tailwind preflight``
    features.push('layer:preflight')

    // `separator` key is located at `options.separator``
    features.push('separator:options')
  }

  // Plugins have browserslist targets passed to them
  if (semver.gte(version, '1.4.0') && semver.lte(version, '1.99.0')) {
    features.push('browserslist-in-plugins')
  }

  if (semver.gte(version, '3.0.0')) {
    // Complex class support is built-in to `@apply` itself
  } else if (semver.gte(version, '1.99.0')) {
    // `applyComplexClasses` is located in `./lib/lib/substituteClassApplyAtRules`
    features.push('apply-complex-classes')
  } else if (semver.gte(version, '1.7.0')) {
    // `applyComplexClasses` is located in './lib/flagged/applyComplexClasses' and must be enabled via a feature flag
    features.push('apply-complex-classes:flagged')
  }

  if (semver.gte(version, '3.0.0')) {
    // A `content` key is used to define the list of files to scan for classes
    features.push('content-list')
  } else {
    // A `purge` key is used to define the list of files to scan for classes
    features.push('purge-list')
  }

  if (semver.gte(version, '3.0.0')) {
    features.push('jit')
  } else if (semver.gte(version, '2.1.0')) {
    // TODO: v2.1 Check for JIT based on config file?
  }

  if (semver.gte(version, '3.2.0')) {
    // Support for the `@config` directive in CSS to customize the located config file
    features.push('css-at-config-as-project')

    // Support for relative content paths
    features.push('relative-content-paths')
  }

  if (semver.gte(version, '3.3.0')) {
    // Supports ESM and TS configs via `loadConfig` by transpiling them to CJS on the fly
    features.push('transpiled-configs')
  }

  return features
}
