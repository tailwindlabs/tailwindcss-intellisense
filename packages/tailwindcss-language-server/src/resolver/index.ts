import * as fs from 'node:fs'
import * as path from 'node:path'
import {
  CachedInputFileSystem,
  ResolverFactory,
  Resolver as BaseResolver,
  FileSystem,
} from 'enhanced-resolve'
import { loadPnPApi, type PnpApi } from './pnp'
import { loadTsConfig, type TSConfigApi } from './tsconfig'
import { normalizeYarnPnPDriveLetter } from '../utils'

export interface ResolverOptions {
  /**
   * The root directory for the resolver
   */
  root: string

  /**
   * Whether or not the resolver should attempt to use PnP resolution.
   *
   * If `true`, the resolver will attempt to load the PnP API and use it for
   * resolution. However, if an API is provided, the resolver will use that API
   * instead.
   */
  pnp?: boolean | PnpApi

  /**
   * Whether or not the resolver should load tsconfig path mappings.
   *
   * If `true`, the resolver will look for all `tsconfig` files in the project
   * and use them to resolve module paths where possible. However, if an API is
   * provided, the resolver will use that API to resolve module paths.
   */
  tsconfig?: boolean | TSConfigApi

  /**
   * A filesystem to use for resolution. If not provided, the resolver will
   * create one and use it internally for itself and any child resolvers that
   * do not provide their own filesystem.
   */
  fileSystem?: FileSystem
}

export interface Resolver {
  /**
   * Resolves a JavaScript module to a file path.
   *
   * Assumes dynamic imports or some other ESM-captable mechanism will be used
   * to load the module. Tries to resolve the ESM module first, then falls back
   * to the CommonJS module if the ESM module is not found.
   *
   * @param id The module or file to resolve
   * @param base The base directory to resolve the module from
   */
  resolveJsId(id: string, base: string): Promise<string>

  /**
   * Resolves a CJS module to a file path.
   *
   * Assumes ESM-captable mechanisms are not available.
   *
   * @param id The module or file to resolve
   * @param base The base directory to resolve the module from
   */
  resolveCjsId(id: string, base: string): Promise<string>

  /**
   * Resolves a CSS module to a file path.
   *
   * @param id The module or file to resolve
   * @param base The base directory to resolve the module from
   */
  resolveCssId(id: string, base: string): Promise<string>

  /**
   * Resolves a module to a possible file or directory path.
   *
   * This provides reasonable results when TypeScript config files are in use.
   * This file may not exist but is the likely path that would be used to load
   * the module if it were to exist.
   *
   * @param id The module, file, or directory to resolve
   * @param base The base directory to resolve the module from
   */
  substituteId(id: string, base: string): Promise<string>

  /**
   * Return a list of path resolution aliases for the given base directory
   */
  aliases(base: string): Promise<Record<string, string[]>>

  /**
   * Create a child resolver with the given options.
   *
   * Use this to share state between resolvers. For example, if a resolver has
   * already loaded the PnP API, you can create a child resolver that reuses
   * the same PnP API without needing to load it again.
   */
  child(opts: Partial<ResolverOptions>): Promise<Resolver>

  /**
   * Whether or not the PnP API is being used by the resolver
   */
  hasPnP(): Promise<boolean>

  /**
   * Refresh information the resolver may have cached
   *
   * This may look for new TypeScript configs if necessary
   */
  refresh(): Promise<void>
}

export async function createResolver(opts: ResolverOptions): Promise<Resolver> {
  let pnpApi: PnpApi | null = null

  // Load PnP API if requested
  // This MUST be done before `CachedInputFileSystem` is created
  if (typeof opts.pnp === 'object') {
    pnpApi = opts.pnp
  } else if (opts.pnp) {
    pnpApi = await loadPnPApi(opts.root)
  }

  let fileSystem = opts.fileSystem ? opts.fileSystem : new CachedInputFileSystem(fs, 4000)

  let tsconfig: TSConfigApi | null = null

  // Load TSConfig path mappings
  if (typeof opts.tsconfig === 'object') {
    tsconfig = opts.tsconfig
  } else if (opts.tsconfig) {
    try {
      tsconfig = await loadTsConfig(opts.root)
    } catch (err) {
      // We don't want to hard crash in case of an error handling tsconfigs
      // It does affect what projects we can resolve or how we load files
      // but the LSP shouldn't become unusable because of it.
      console.error('Failed to load tsconfig', err)
    }
  }

  let esmResolver = ResolverFactory.createResolver({
    fileSystem,
    // .json is omitted since Node does not support await import('foo.json')
    extensions: ['.mjs', '.js', '.node', '.mts', '.ts'],
    mainFields: ['module'],
    conditionNames: ['node', 'import'],
    pnpApi,
  })

  let cjsResolver = ResolverFactory.createResolver({
    fileSystem,
    extensions: ['.cjs', '.js', '.json', '.node', '.cts', '.ts'],
    mainFields: ['main'],
    conditionNames: ['node', 'require'],
    pnpApi,
  })

  let cssResolver = ResolverFactory.createResolver({
    fileSystem,
    extensions: ['.css'],
    mainFields: ['style'],
    conditionNames: ['style'],
    pnpApi,

    // Given `foo/bar.css` try `./foo/bar.css` first before trying `foo/bar.css`
    // as a module
    preferRelative: true,
  })

  let absoluteCssResolver = ResolverFactory.createResolver({
    fileSystem,
    extensions: ['.css'],
    mainFields: ['style'],
    conditionNames: ['style'],
    pnpApi,

    // Used as a fallback when a file ends up importing itself
    preferRelative: false,
  })

  async function resolveId(
    resolver: BaseResolver,
    id: string,
    base: string,
  ): Promise<string | false> {
    // Windows-specific path tweaks
    if (path.sep === '\\') {
      // Absolute path on Network Share
      if (id.startsWith('\\\\')) return id

      // Absolute path on Network Share (normalized)
      if (id.startsWith('//')) return id

      // Relative to Network Share (normalized)
      if (base.startsWith('//')) base = `\\\\${base.slice(2)}`
    }

    if (tsconfig) {
      let match = await tsconfig.resolveId(id, base)
      if (match) id = match
    }

    // 2. Normalize the drive letters to the case that the PnP API expects
    id = normalizeYarnPnPDriveLetter(id)
    base = normalizeYarnPnPDriveLetter(base)

    let result = await new Promise<string | false>((resolve, reject) => {
      resolver.resolve({}, base, id, {}, (err, res) => {
        if (err) {
          reject(err)
        } else {
          resolve(res)
        }
      })
    })

    if (!result) return false

    // The `enhanced-resolve` package supports resolving paths with fragment
    // identifiers. For example, it can resolve `foo/bar#baz` to `foo/bar.js`
    // However, it's also possible that a path contains a `#` character as part
    // of the path itself. For example, `foo#bar` might point to a file named
    // `foo#bar.js`. The resolver distinguishes between these two cases by
    // escaping the `#` character with a NUL byte when it's part of the path.
    //
    // Since the real path doesn't actually contain NUL bytes, we need to remove
    // them to get the correct path otherwise readFileSync will throw an error.
    result = result.replace(/\0(.)/g, '$1')

    return result
  }

  async function resolveJsId(id: string, base: string): Promise<string> {
    try {
      return (await resolveId(esmResolver, id, base)) || id
    } catch {
      return (await resolveId(cjsResolver, id, base)) || id
    }
  }

  async function resolveCjsId(id: string, base: string): Promise<string> {
    return (await resolveId(cjsResolver, id, base)) || id
  }

  async function resolveCssId(id: string, base: string): Promise<string> {
    // If the ID matches `tailwindcss` exactly we tell the CSS resolver to
    // ignore relative file paths. This ensures that Tailwind CSS itself is
    // found even when a stylesheet named `tailwindcss.css` exists.
    //
    // If someone needs to import that stylesheet it must be done by:
    // - relative path: `@import "./tailwindcss"`
    // - adding an extension: `@import "tailwindcss.css"`
    //
    // Ideally this code would only be in place if the _importer_ is
    // `tailwindcss.css` but that data is not available. Only the base
    // path is so we enable it all the time.
    //
    // https://github.com/tailwindlabs/tailwindcss-intellisense/issues/1427
    let resolver = id === 'tailwindcss' ? absoluteCssResolver : cssResolver

    return (await resolveId(resolver, id, base)) || id
  }

  // Takes a path which may or may not be complete and returns the aliased path
  // if possible
  async function substituteId(id: string, base: string): Promise<string> {
    return (await tsconfig?.substituteId(id, base)) ?? id
  }

  async function aliases(base: string) {
    if (!tsconfig) return {}

    return await tsconfig.paths(base)
  }

  async function refresh() {
    await tsconfig?.refresh()
  }

  async function hasPnP() {
    return !!pnpApi
  }

  return {
    resolveJsId,
    resolveCjsId,
    resolveCssId,
    substituteId,
    refresh,
    hasPnP,

    aliases,

    child(childOpts: Partial<ResolverOptions>) {
      return createResolver({
        ...opts,
        ...childOpts,

        // Inherit defaults from parent
        pnp: childOpts.pnp ?? pnpApi,
        tsconfig: childOpts.tsconfig ?? tsconfig,
        fileSystem: childOpts.fileSystem ?? fileSystem,
      })
    },
  }
}
