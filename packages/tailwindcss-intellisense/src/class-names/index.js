import extractClassNames from './extractClassNames'
import Hook from './hook'
import dlv from 'dlv'
import dset from 'dset'
import chokidar from 'chokidar'
import semver from 'semver'
import invariant from 'tiny-invariant'
import getPlugins from './getPlugins'
import getVariants from './getVariants'
import resolveConfig from './resolveConfig'
import * as path from 'path'
import * as fs from 'fs'
import * as os from 'os'
import { getUtilityConfigMap } from './getUtilityConfigMap'
import glob from 'fast-glob'
import normalizePath from 'normalize-path'
import { withUserEnvironment } from './environment'
import execa from 'execa'
import { klona } from 'klona/full'

function arraysEqual(arr1, arr2) {
  return (
    JSON.stringify(arr1.concat([]).sort()) ===
    JSON.stringify(arr2.concat([]).sort())
  )
}

const CONFIG_GLOB =
  '**/{tailwind,tailwind.config,tailwind-config,.tailwindrc}.{js,cjs}'

export default async function getClassNames(
  cwd = process.cwd(),
  { onChange = () => {} } = {}
) {
  async function run() {
    const configPaths = (
      await glob(CONFIG_GLOB, {
        cwd,
        ignore: ['**/node_modules'],
        onlyFiles: true,
        absolute: true,
        suppressErrors: true,
        // fast-glob defaults concurrency to `os.cpus().length`,
        // but this can be 0, so we override it here, ensuring
        // that concurrency is at least 1. Fix is here but is
        // currently unpublished:
        // https://github.com/mrmlnc/fast-glob/pull/296
        concurrency: Math.max(os.cpus().length, 1),
      })
    )
      .map(normalizePath)
      .sort((a, b) => a.split('/').length - b.split('/').length)
      .map(path.normalize)

    invariant(configPaths.length > 0, 'No Tailwind CSS config found.')
    const configPath = configPaths[0]
    const configDir = path.dirname(configPath)
    const {
      version,
      featureFlags = { future: [], experimental: [] },
      tailwindBase,
    } = loadMeta(configDir, cwd)

    const sepLocation = semver.gte(version, '0.99.0')
      ? ['separator']
      : ['options', 'separator']
    let userSeperator
    let userPurge
    let hook = Hook(fs.realpathSync(configPath), (exports) => {
      userSeperator = dlv(exports, sepLocation)
      userPurge = exports.purge
      dset(
        exports,
        sepLocation,
        `__TWSEP__${
          typeof userSeperator === 'undefined' ? ':' : userSeperator
        }__TWSEP__`
      )
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

    const {
      postcssResult,
      resolvedConfig,
      browserslist,
      postcss,
    } = await withPackages(
      {
        configDir,
        cwd,
        userSeperator,
        version,
      },
      async ({
        postcss,
        tailwindcss,
        browserslistCommand,
        browserslistArgs,
      }) => {
        let postcssResult
        try {
          postcssResult = await postcss([tailwindcss(configPath)]).process(
            [
              semver.gte(version, '0.99.0') ? 'base' : 'preflight',
              'components',
              'utilities',
            ]
              .map((x) => `/*__tw_intellisense_layer_${x}__*/\n@tailwind ${x};`)
              .join('\n'),
            {
              from: undefined,
            }
          )
        } catch (error) {
          throw error
        } finally {
          hook.unhook()
        }

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

        const resolvedConfig = resolveConfig({
          base: configDir,
          root: cwd,
          config,
        })

        let browserslist = []
        if (
          browserslistCommand &&
          semver.gte(version, '1.4.0') &&
          semver.lte(version, '1.99.0')
        ) {
          try {
            const { stdout } = await execa(
              browserslistCommand,
              browserslistArgs,
              {
                preferLocal: true,
                localDir: configDir,
                cwd: configDir,
              }
            )
            browserslist = stdout.split('\n')
          } catch (error) {
            console.error('Failed to load browserslist:', error)
          }
        }

        return {
          postcssResult,
          resolvedConfig,
          postcss,
          browserslist,
        }
      }
    )

    return {
      version,
      configPath,
      config: resolvedConfig,
      separator: typeof userSeperator === 'undefined' ? ':' : userSeperator,
      classNames: await extractClassNames(postcssResult.root),
      dependencies: hook.deps,
      plugins: getPlugins(config),
      variants: getVariants({ config, version, postcss, browserslist }),
      utilityConfigMap: await getUtilityConfigMap({
        base: configDir,
        root: cwd,
        resolvedConfig,
        postcss,
        browserslist,
      }),
      modules: {
        postcss,
      },
      featureFlags,
    }
  }

  let watcher
  function watch(files = []) {
    unwatch()
    watcher = chokidar
      .watch(files, { cwd, ignorePermissionErrors: true })
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
  } catch (error) {
    console.error('Failed to initialise:', error)
    return null
  }

  watch([result.configPath, ...result.dependencies])

  return result
}

function loadMeta(configDir, root) {
  return withUserEnvironment(configDir, root, ({ require, resolve }) => {
    const tailwindBase = path.dirname(resolve('tailwindcss/package.json'))
    const version = require('tailwindcss/package.json').version
    let featureFlags

    try {
      featureFlags = require('./lib/featureFlags.js', tailwindBase).default
    } catch (_) {}

    return { version, featureFlags, tailwindBase }
  })
}

function withPackages({ configDir, cwd, userSeperator, version }, cb) {
  return withUserEnvironment(
    configDir,
    cwd,
    async ({ isPnp, require, resolve }) => {
      const tailwindBase = path.dirname(resolve('tailwindcss/package.json'))
      const postcss = require('postcss', tailwindBase)
      const tailwindcss = require('tailwindcss')

      let browserslistCommand
      let browserslistArgs = []
      try {
        const browserslistBin = resolve(
          path.join(
            'browserslist',
            require('browserslist/package.json', tailwindBase).bin.browserslist
          ),
          tailwindBase
        )
        if (isPnp) {
          browserslistCommand = 'yarn'
          browserslistArgs = ['node', browserslistBin]
        } else {
          browserslistCommand = process.execPath
          browserslistArgs = [browserslistBin]
        }
      } catch (_) {}

      if (semver.gte(version, '1.7.0')) {
        const applyComplexClasses = semver.gte(version, '1.99.0')
          ? require('./lib/lib/substituteClassApplyAtRules', tailwindBase)
          : require('./lib/flagged/applyComplexClasses', tailwindBase)

        if (!applyComplexClasses.default.__patched) {
          let _applyComplexClasses = applyComplexClasses.default
          applyComplexClasses.default = (config, ...args) => {
            let configClone = klona(config)
            configClone.separator =
              typeof userSeperator === 'undefined' ? ':' : userSeperator

            let fn = _applyComplexClasses(configClone, ...args)

            return async (css) => {
              css.walkRules((rule) => {
                const newSelector = rule.selector.replace(
                  /__TWSEP__(.*?)__TWSEP__/g,
                  '$1'
                )
                if (newSelector !== rule.selector) {
                  rule.before(
                    postcss.comment({
                      text: '__ORIGINAL_SELECTOR__:' + rule.selector,
                    })
                  )
                  rule.selector = newSelector
                }
              })

              await fn(css)

              css.walkComments((comment) => {
                if (comment.text.startsWith('__ORIGINAL_SELECTOR__:')) {
                  comment.next().selector = comment.text.replace(
                    /^__ORIGINAL_SELECTOR__:/,
                    ''
                  )
                  comment.remove()
                }
              })

              return css
            }
          }
          applyComplexClasses.default.__patched = true
        }
      }

      return cb({ postcss, tailwindcss, browserslistCommand, browserslistArgs })
    }
  )
}
