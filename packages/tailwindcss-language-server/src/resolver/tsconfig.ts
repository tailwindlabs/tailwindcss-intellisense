// This implementation is inspired by and very loosely based on a Vite plugin
// with many simplifications and changes for our use case.
//
// The Vite plugin `vite-tsconfig-paths` can be found here:
// MIT License | Copyright (c) Alec Larson
// https://github.com/aleclarson/vite-tsconfig-paths

import * as path from 'node:path'
import * as tsconfig from 'tsconfig-paths'
import * as tsconfck from 'tsconfck'
import { normalizePath } from '../utils'
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
}

export async function loadTsConfig(root: string): Promise<TSConfigApi> {
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

  for (let file of files) {
    try {
      let result = await tsconfck.parse(file, options)
      parsed.add(result)
    } catch (err) {
      console.error(err)
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

  // 4. Create matchers for each project
  interface Matcher {
    (id: string): Promise<string | undefined>
  }

  let resolvers = new DefaultMap<string, Matcher[]>(() => [])
  let substitutes = new DefaultMap<string, Matcher[]>(() => [])
  let pathMap = new Map<string, Record<string, string[]>>()

  for (let result of parsed) {
    let parent = normalizePath(path.dirname(result.tsconfigFile))

    let opts = result.tsconfig.compilerOptions ?? {}

    let baseUrl = findBaseDir(result)
    let absoluteBaseUrl = path.resolve(parent, baseUrl || '')

    let match!: tsconfig.MatchPathAsync
    let matchAny!: tsconfig.MatchPathAsync

    function resolve(id: string) {
      match ??= tsconfig.createMatchPathAsync(
        absoluteBaseUrl,
        opts.paths ?? {},
        undefined,
        baseUrl !== undefined,
      )

      return new Promise<string | undefined>((resolve, reject) => {
        match(id, undefined, undefined, undefined, (err, path) => {
          console.log({ err, path, id, absoluteBaseUrl, paths: opts.paths })
          if (err) {
            reject(err)
          } else {
            resolve(path)
          }
        })
      })
    }

    function substitute(id: string) {
      matchAny ??= tsconfig.createMatchPathAsync(
        absoluteBaseUrl,
        opts.paths ?? {},
        undefined,
        baseUrl !== undefined,
      )

      let isPrefixMatch = id.endsWith('/')
      if (isPrefixMatch) id += '__placeholder__'

      let assumeExists: tsconfig.FileExistsAsync = (_, callback) => callback(undefined, true)

      return new Promise<string | undefined>((resolve, reject) => {
        matchAny(id, undefined, assumeExists, undefined, (err, path) => {
          if (err) return reject(err)

          if (isPrefixMatch) {
            path = path.replace(/__placeholder__$/, '')
          }

          resolve(path)
        })
      })
    }

    resolvers.get(parent).push(resolve)
    substitutes.get(parent).push(substitute)
    pathMap.set(parent, opts.paths ?? {})
  }

  // 5. Create matchers for each project
  async function resolveId(id: string, base: string) {
    for (let projectDir of walkPaths(base)) {
      for (let resolve of resolvers.get(projectDir)) {
        try {
          return await resolve(id)
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
      for (let resolve of substitutes.get(projectDir)) {
        try {
          return await resolve(id)
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
      let paths = pathMap.get(projectDir)
      if (paths) return paths
    }

    return {}
  }

  return {
    resolveId,
    substituteId,
    paths,
  }
}

function* walkPaths(base: string) {
  let projectDir = normalizePath(base)

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
