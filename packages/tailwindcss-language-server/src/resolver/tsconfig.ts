// This implementation is inspired by and very loosely based on a Vite plugin
// with many simplifications and changes for our use case.
//
// The Vite plugin `vite-tsconfig-paths` can be found here:
// MIT License | Copyright (c) Alec Larson
// https://github.com/aleclarson/vite-tsconfig-paths

import * as path from 'node:path'
import * as tsconfig from 'tsconfig-paths'
import * as tsconfck from 'tsconfck'
import { normalizeDriveLetter, normalizePath } from '../utils'
import { DefaultMap } from '../util/default-map'

export interface TSConfigApi {
  /**
   * Get the tsconfig paths used in the given directory
   *
   * @param base The directory to get the paths for
   */
  paths(base: string): Promise<Record<string, string[]>>

  /**
   * Resolve a module to a file path based on the tsconfig paths
   *
   * @param id   The module or file to resolve
   * @param base The directory to resolve the module from
   */
  resolveId(id: string, base: string): Promise<string | undefined>

  /**
   * Given an id and base path turn it into a path that's likely to be
   * the one that will can be used to load the module.
   *
   * @param id   The module, file, or directory to resolve
   * @param base The directory to resolve the module from
   */
  substituteId(id: string, base: string): Promise<string | undefined>

  /**
   * Refresh information on available tsconfig paths.
   *
   * This rescans the project for tsconfig files and updates the matchers.
   */
  refresh(): Promise<void>

  /**
   * Errors we encountered while trying to load the tsconfig files.
   *
   * We don't crash on errors because we want to be able to provide partial info
   * even if some of the tsconfig files are invalid.
   */
  errors: unknown[]
}

export async function loadTsConfig(root: string): Promise<TSConfigApi> {
  let { configs, errors } = await findConfigs(root)

  let matchers = await createMatchers(configs)

  // 5. Create matchers for each project
  async function resolveId(id: string, base: string) {
    for (let projectDir of walkPaths(base)) {
      for (let { match } of matchers.get(projectDir)) {
        try {
          return await match(id)
        } catch (err) {
          // If we got here we found a valid resolver for this path but it
          // failed to resolve the path then we should stop looking. If we
          // didn't we might end up using a resolver that would give us a
          // valid path but not the one we want.
          return null
        }
      }
    }

    return null
  }

  async function substituteId(id: string, base: string) {
    for (let projectDir of walkPaths(base)) {
      for (let { match } of matchers.get(projectDir)) {
        try {
          return await match(id, { mustExist: false })
        } catch (err) {
          // If we got here we found a valid resolver for this path but it
          // failed to resolve the path then we should stop looking. If we
          // didn't we might end up using a resolver that would give us a
          // valid path but not the one we want.
          return null
        }
      }
    }

    return null
  }

  async function paths(base: string) {
    for (let projectDir of walkPaths(base)) {
      for (let { paths } of matchers.get(projectDir)) {
        if (Object.keys(paths).length) return paths
      }
    }

    return {}
  }

  async function refresh() {
    let { configs, errors } = await findConfigs(root)

    matchers = await createMatchers(configs)

    if (errors.length) {
      throw new AggregateError(errors)
    }
  }

  return {
    resolveId,
    substituteId,
    paths,
    refresh,
    errors,
  }
}

async function findConfigs(root: string): Promise<{
  configs: Set<tsconfck.TSConfckParseResult>
  errors: unknown[]
}> {
  // 1. Find all tsconfig files in the project
  let files = await tsconfck.findAll(root, {
    configNames: ['tsconfig.json', 'jsconfig.json'],
    skip(dir) {
      if (dir === 'node_modules') return true
      if (dir === '.git') return true

      // TODO: Incorporate thee `exclude` option from VSCode settings.
      //
      // Doing so here is complicated because we don't have access to the
      // full path to the file here and we need that to match it against the
      // exclude patterns.
      //
      // This probably means we need to filter them after we've found them all.

      return false
    },
  })

  // 2. Load them all
  let options: tsconfck.TSConfckParseOptions = {
    root,
    cache: new tsconfck.TSConfckCache(),
  }

  let parsed = new Set<tsconfck.TSConfckParseResult>()
  let errors: unknown[] = []

  for (let file of files) {
    try {
      let result = await tsconfck.parse(file, options)
      parsed.add(result)
    } catch (err) {
      errors.push(err)
    }
  }

  // 3. Extract referenced projects
  for (let result of parsed) {
    if (!result.referenced) continue

    // Mach against referenced projects rather than the project itself
    for (let ref of result.referenced) {
      parsed.add(ref)
    }

    // And use the project itself as a fallback since project references can
    // be used to override the parent project.
    parsed.delete(result)
    parsed.add(result)

    result.referenced = undefined
  }

  for (let err of errors) {
    console.error(err)
  }

  return { configs: parsed, errors }
}

interface MatchOptions {
  mustExist?: boolean
}

interface Matcher {
  match(id: string, opts?: MatchOptions): Promise<string | undefined>
  paths: Record<string, string[]>
}

async function createMatchers(
  configs: Iterable<tsconfck.TSConfckParseResult>,
): Promise<Map<string, Matcher[]>> {
  let matchers = new DefaultMap<string, Matcher[]>(() => [])

  let assumeExists: tsconfig.FileExistsAsync = (_, callback) => callback(undefined, true)

  for (let result of configs) {
    let parent = normalizeDriveLetter(normalizePath(path.dirname(result.tsconfigFile)))

    let opts = result.tsconfig.compilerOptions ?? {}

    let baseUrl = findBaseDir(result)
    let absoluteBaseUrl = path.resolve(parent, baseUrl || '')

    let matchPath!: tsconfig.MatchPathAsync

    function match(id: string, { mustExist = true }: MatchOptions = {}) {
      matchPath ??= tsconfig.createMatchPathAsync(
        absoluteBaseUrl,
        opts.paths ?? {},
        undefined,
        baseUrl !== undefined,
      )

      let isPrefixMatch = mustExist === false ? id.endsWith('/') : false

      if (isPrefixMatch) {
        id += '__placeholder__'
      }

      return new Promise<string | undefined>((resolve, reject) => {
        matchPath(
          id,
          undefined,
          mustExist === false ? assumeExists : undefined,
          undefined,
          (err, path) => {
            if (err) return reject(err)

            if (isPrefixMatch) {
              path = path.replace(/__placeholder__$/, '')
            }

            return resolve(path)
          },
        )
      })
    }

    matchers.get(parent).push({
      match,
      paths: opts.paths ?? {},
    })
  }

  return matchers
}

function* walkPaths(base: string) {
  let projectDir = normalizeDriveLetter(normalizePath(base))

  let prevProjectDir: string | undefined
  while (projectDir !== prevProjectDir) {
    yield projectDir

    prevProjectDir = projectDir
    projectDir = path.dirname(projectDir)
  }

  return null
}

function findBaseDir(project: tsconfck.TSConfckParseResult): string {
  let baseUrl = project.tsconfig.compilerOptions?.baseUrl
  if (baseUrl) return baseUrl

  for (let p of project.extended ?? []) {
    let opts = p.tsconfig.compilerOptions ?? {}
    if (opts?.paths) {
      return path.dirname(p.tsconfigFile)
    }
  }

  return path.dirname(project.tsconfigFile)
}
