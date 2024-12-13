import * as fs from 'node:fs'
import * as path from 'node:path'
import {
  CachedInputFileSystem,
  ResolverFactory,
  Resolver as BaseResolver,
  FileSystem,
} from 'enhanced-resolve'
import { loadPnPApi, type PnpApi } from './pnp'

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
   * A filesystem to use for resolution. If not provided, the resolver will
   * create one and use it internally for itself and any child resolvers that
   * do not provide their own filesystem.
   */
  fileSystem?: FileSystem
}

export interface Resolver {
  /**
   * Sets up the PnP API if it is available such that globals like `require`
   * have been monkey-patched to use PnP resolution.
   *
   * This function does nothing if PnP resolution is not enabled or if the PnP
   * API is not available.
   */
  setupPnP(): Promise<void>

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
   * Resolves a CSS module to a file path.
   *
   * @param id The module or file to resolve
   * @param base The base directory to resolve the module from
   */
  resolveCssId(id: string, base: string): Promise<string>

  /**
   * Create a child resolver with the given options.
   *
   * Use this to share state between resolvers. For example, if a resolver has
   * already loaded the PnP API, you can create a child resolver that reuses
   * the same PnP API without needing to load it again.
   */
  child(opts: Partial<ResolverOptions>): Promise<Resolver>
}

export async function createResolver(opts: ResolverOptions): Promise<Resolver> {
  let fileSystem = opts.fileSystem ? opts.fileSystem : new CachedInputFileSystem(fs, 4000)

  let pnpApi: PnpApi | null = null

  // Load PnP API if requested
  if (typeof opts.pnp === 'object') {
    pnpApi = opts.pnp
  } else if (opts.pnp) {
    pnpApi = await loadPnPApi(opts.root)
  }

  let esmResolver = ResolverFactory.createResolver({
    fileSystem,
    extensions: ['.mjs', '.js'],
    mainFields: ['module'],
    conditionNames: ['node', 'import'],
    pnpApi,
  })

  let cjsResolver = ResolverFactory.createResolver({
    fileSystem,
    extensions: ['.cjs', '.js'],
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

    return new Promise((resolve, reject) => {
      resolver.resolve({}, base, id, {}, (err, res) => {
        if (err) {
          reject(err)
        } else {
          resolve(res)
        }
      })
    })
  }

  async function resolveJsId(id: string, base: string): Promise<string> {
    try {
      return (await resolveId(esmResolver, id, base)) || id
    } catch {
      return (await resolveId(cjsResolver, id, base)) || id
    }
  }

  async function resolveCssId(id: string, base: string): Promise<string> {
    return (await resolveId(cssResolver, id, base)) || id
  }

  async function setupPnP() {
    pnpApi?.setup()
  }

  return {
    setupPnP,
    resolveJsId,
    resolveCssId,

    child(childOpts: Partial<ResolverOptions>) {
      return createResolver({
        ...opts,
        ...childOpts,

        // Inherit defaults from parent
        pnp: childOpts.pnp ?? pnpApi,
        fileSystem: childOpts.fileSystem ?? fileSystem,
      })
    },
  }
}
