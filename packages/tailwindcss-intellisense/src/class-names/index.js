import extractClassNames from './extractClassNames'
import Hook from './hook'
import dlv from 'dlv'
import dset from 'dset'
import resolveFrom from 'resolve-from'
import importFrom from 'import-from'
import chokidar from 'chokidar'
import semver from 'semver'
import invariant from 'tiny-invariant'
import getPlugins from './getPlugins'
import getVariants from './getVariants'
import resolveConfig from './resolveConfig'
import * as path from 'path'
import * as fs from 'fs'
import { getUtilityConfigMap } from './getUtilityConfigMap'
import glob from 'fast-glob'
import normalizePath from 'normalize-path'

function arraysEqual(arr1, arr2) {
  return (
    JSON.stringify(arr1.concat([]).sort()) ===
    JSON.stringify(arr2.concat([]).sort())
  )
}

const CONFIG_GLOB =
  '**/{tailwind,tailwind.config,tailwind-config,.tailwindrc}.js'

export default async function getClassNames(
  cwd = process.cwd(),
  { onChange = () => {} } = {}
) {
  async function run() {
    let postcss
    let tailwindcss
    let browserslistModule
    let version
    let featureFlags = { future: [], experimental: [] }

    const configPaths = (
      await glob(CONFIG_GLOB, {
        cwd,
        ignore: ['**/node_modules'],
        onlyFiles: true,
        absolute: true,
        suppressErrors: true,
      })
    )
      .map(normalizePath)
      .sort((a, b) => a.split('/').length - b.split('/').length)
      .map(path.normalize)

    invariant(configPaths.length > 0, 'No Tailwind CSS config found.')
    const configPath = configPaths[0]
    const configDir = path.dirname(configPath)
    const tailwindBase = path.dirname(
      resolveFrom(configDir, 'tailwindcss/package.json')
    )
    postcss = importFrom(tailwindBase, 'postcss')
    tailwindcss = importFrom(configDir, 'tailwindcss')
    version = importFrom(configDir, 'tailwindcss/package.json').version

    try {
      // this is not required
      browserslistModule = importFrom(tailwindBase, 'browserslist')
    } catch (_) {}

    try {
      featureFlags = importFrom(tailwindBase, './lib/featureFlags.js').default
    } catch (_) {}

    const sepLocation = semver.gte(version, '0.99.0')
      ? ['separator']
      : ['options', 'separator']
    let userSeperator
    let userPurge
    let hook = Hook(fs.realpathSync(configPath), (exports) => {
      userSeperator = dlv(exports, sepLocation)
      userPurge = exports.purge
      dset(exports, sepLocation, '__TAILWIND_SEPARATOR__')
      exports.purge = {}
      return exports
    })

    hook.watch()
    let config
    try {
      config = __non_webpack_require__(configPath)
    } catch (error) {
      hook.unwatch()
      hook.unhook()
      throw error
    }

    hook.unwatch()

    let postcssResult

    try {
      postcssResult = await Promise.all(
        [
          semver.gte(version, '0.99.0') ? 'base' : 'preflight',
          'components',
          'utilities',
        ].map((group) =>
          postcss([tailwindcss(configPath)]).process(`@tailwind ${group};`, {
            from: undefined,
          })
        )
      )
    } catch (error) {
      throw error
    } finally {
      hook.unhook()
    }

    const [base, components, utilities] = postcssResult

    if (typeof userSeperator !== 'undefined') {
      dset(config, sepLocation, userSeperator)
    } else {
      delete config[sepLocation]
    }
    if (typeof userPurge !== 'undefined') {
      config.purge = userPurge
    } else {
      delete config.purge
    }

    const resolvedConfig = resolveConfig({ cwd: configDir, config })
    const browserslist = browserslistModule
      ? browserslistModule(undefined, {
          path: configDir,
        })
      : []

    return {
      version,
      configPath,
      config: resolvedConfig,
      separator: typeof userSeperator === 'undefined' ? ':' : userSeperator,
      classNames: await extractClassNames([
        { root: base.root, source: 'base' },
        { root: components.root, source: 'components' },
        { root: utilities.root, source: 'utilities' },
      ]),
      dependencies: hook.deps,
      plugins: getPlugins(config),
      variants: getVariants({ config, version, postcss, browserslist }),
      utilityConfigMap: await getUtilityConfigMap({
        cwd: configDir,
        resolvedConfig,
        postcss,
        browserslist,
      }),
      modules: {
        tailwindcss,
        postcss,
      },
      featureFlags,
    }
  }

  let watcher
  function watch(files = []) {
    unwatch()
    watcher = chokidar
      .watch(files, { cwd })
      .on('change', handleChange)
      .on('unlink', handleChange)
  }
  function unwatch() {
    if (watcher) {
      watcher.close()
    }
  }

  async function handleChange() {
    const prevDeps = result ? [result.configPath, ...result.dependencies] : []
    try {
      result = await run()
    } catch (error) {
      onChange({ error })
      return
    }
    const newDeps = [result.configPath, ...result.dependencies]
    if (!arraysEqual(prevDeps, newDeps)) {
      watch(newDeps)
    }
    onChange(result)
  }

  let result
  try {
    result = await run()
  } catch (_) {
    return null
  }

  watch([result.configPath, ...result.dependencies])

  return result
}
