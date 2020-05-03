import extractClassNames from './extractClassNames'
import Hook from './hook'
import dlv from 'dlv'
import dset from 'dset'
import importFrom from 'import-from'
import chokidar from 'chokidar'
import semver from 'semver'
import invariant from 'tiny-invariant'
import getPlugins from './getPlugins'
import getVariants from './getVariants'
import resolveConfig from './resolveConfig'
import * as util from 'util'
import * as path from 'path'
import { globSingle } from './globSingle'
import { getUtilityConfigMap } from './getUtilityConfigMap'

function TailwindConfigError(error) {
  Error.call(this)
  Error.captureStackTrace(this, this.constructor)

  this.name = this.constructor.name
  this.message = error.message
  this.stack = error.stack
}

util.inherits(TailwindConfigError, Error)

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
    let configPath
    let postcss
    let tailwindcss
    let browserslistModule
    let version

    configPath = await globSingle(CONFIG_GLOB, {
      cwd,
      filesOnly: true,
      absolute: true,
      flush: true,
    })
    invariant(configPath.length === 1, 'No Tailwind CSS config found.')
    configPath = configPath[0]
    const configDir = path.dirname(configPath)
    postcss = importFrom(configDir, 'postcss')
    tailwindcss = importFrom(configDir, 'tailwindcss')
    version = importFrom(configDir, 'tailwindcss/package.json').version

    try {
      // this is not required
      browserslistModule = importFrom(configDir, 'browserslist')
    } catch (_) {}

    const sepLocation = semver.gte(version, '0.99.0')
      ? ['separator']
      : ['options', 'separator']
    let userSeperator
    let hook = Hook(configPath, (exports) => {
      userSeperator = dlv(exports, sepLocation)
      dset(exports, sepLocation, '__TAILWIND_SEPARATOR__')
      return exports
    })

    hook.watch()
    let config
    try {
      config = __non_webpack_require__(configPath)
    } catch (error) {
      throw new TailwindConfigError(error)
    }
    hook.unwatch()

    const ast = await postcss([tailwindcss(configPath)]).process(
      `
        @tailwind components;
        @tailwind utilities;
      `,
      { from: undefined }
    )

    hook.unhook()

    if (typeof userSeperator !== 'undefined') {
      dset(config, sepLocation, userSeperator)
    } else {
      delete config[sepLocation]
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
      classNames: await extractClassNames(ast),
      dependencies: hook.deps,
      plugins: getPlugins(config),
      variants: getVariants({ config, version, postcss, browserslist }),
      utilityConfigMap: await getUtilityConfigMap({
        cwd: configDir,
        resolvedConfig,
        postcss,
        browserslist,
      }),
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
      if (error instanceof TailwindConfigError) {
        onChange({ error })
      } else {
        unwatch()
        onChange(null)
      }
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
