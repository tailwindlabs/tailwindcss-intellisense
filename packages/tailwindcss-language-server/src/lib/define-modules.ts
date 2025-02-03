import { Module, register } from 'node:module'
import { pathToFileURL } from 'node:url'
import { MessageChannel, type MessagePort } from 'node:worker_threads'
import * as fs from 'node:fs/promises'

// NOTE: If the minimum supported Node version gets above v23.6.0+ then this
// entire file can be massively simplified by using `registerHooks(…)`
interface LoaderState {
  /**
   * Whether or not the loader is enabled
   */
  enabled: boolean

  /**
   * The list of "hooked" module IDs
   */
  modules: string[]

  /**
   * The port used to communicate with the main thread
   */
  port?: MessagePort | null
}

export interface ModuleHook {
  enable: () => Promise<void>
  disable: () => Promise<void>
  during: <T>(fn: () => Promise<T>) => Promise<T>
}

/**
 * Hooks `require(…)`, `await import(…)`, and `import from "…"` so that  the
 * given modules are returned instead of being loaded from disk.
 */
export function defineModules(modules: Record<string, unknown>): ModuleHook {
  // The channel used to communicate between the main and loader threads
  // - port1: used by the main thread
  // - port2: used by the loader thread
  let channel = new MessageChannel()

  // The current state of the loader
  // A copy of this is kept in and used by the loader thread
  let state: LoaderState = {
    enabled: false,
    modules: Object.keys(modules),
  }

  function update(partial: Partial<LoaderState>) {
    Object.assign(state, partial)
    channel.port1.postMessage({ state })
  }

  // Define a global function that can be used to load bundled modules
  // This is used by both the require() replacement and the ESM loader
  globalThis.__tw_load__ = (id: string) => modules[id]

  // Hook into require() and createRequire() so they can load the given modules
  function wrapRequire(original: NodeJS.Require) {
    function customRequire(id: string) {
      fs.appendFile('loader.log', 'loader require(' + id + ')\n')

      if (!state.enabled) return original.call(this, id)
      if (!state.modules.includes(id)) return original.call(this, id)
      return globalThis.__tw_load__(id)
    }

    function customresolve(id: string) {
      if (!state.enabled) return original.resolve.apply(this, arguments)
      if (!state.modules.includes(id)) return original.resolve.apply(this, arguments)
      return id
    }

    return Object.assign(
      customRequire,
      // Make sure we carry over other properties of the original require(…)
      original,
      // Replace `require.resolve(…)` with our custom resolver
      { resolve: customresolve },
    )
  }

  let origRequire = Module.prototype.require
  let origCreateRequire = Module.createRequire

  // Augment the default "require" available in every CJSS module
  Module.prototype.require = wrapRequire(origRequire)

  // Augment any "require" created by the "createRequire" method so require
  // calls used by ES modules are also intercepted.
  Module.createRequire = function () {
    return wrapRequire(origCreateRequire.apply(this, arguments))
  }

  // Hook into the static and dynamic ESM imports so that they can load bundled modules
  let uri = `data:text/javascript;base64,${btoa(loader)}`
  channel.port2.unref()
  register(uri, {
    parentURL: pathToFileURL(__filename),
    transferList: [channel.port2],
    data: {
      state: {
        ...state,
        port: channel.port2,
      },
    },
  })

  let enable = async () => {
    await fs.appendFile('loader.log', 'loader enable' + '\n')
    update({ enabled: true })
  }

  let disable = async () => {
    update({ enabled: false })
    await fs.appendFile('loader.log', 'loader disable' + '\n')
  }

  let during = async <T>(fn: () => Promise<T>) => {
    await enable()
    try {
      return await fn()
    } finally {
      await disable()
    }
  }

  return { enable, disable, during }
}

/**
 * The loader here is embedded as a string rather than a separate JS file because that complicates
 * the build process. We can turn this into a data URI and use it directly. It lets us keep this
 * file entirely self-contained feature-wise.
 */
const js = String.raw
const loader = js`
  import { Module } from "node:module";
  import * as fs from "node:fs/promises";

  /** @type {LoaderState} */
  const state = {
    enabled: false,
    modules: [],
    port: null,
  };

  /** Updates the current state of the loader */
  function sync(data) {
    Object.assign(state, data.state ?? {})
  }

  /** Set up communication with the main thread */
  export async function initialize(data) {
    sync(data);
    state.port?.on("message", sync);
  }

  /** Returns the a special ID for known, bundled modules */
  export async function resolve(id, context, next) {
    await fs.appendFile("loader.log", "loader resolve " + id + "\n");

    if (!state.enabled) return next(id, context);
    if (!state.modules.includes(id)) return next(id, context);

    return {
      shortCircuit: true,
      url: 'bundled:' + id,
    };
  }

  /* Loads a bundled module using a global handler */
  export async function load(url, context, next) {
    await fs.appendFile("loader.log", "loader load " + url + "\n");

    if (!state.enabled) return next(url, context);
    if (!url.startsWith("bundled:")) return next(url, context);

    let id = url.slice(8);
    if (!state.modules.includes(id)) return next(url, context);

    let source = 'export default globalThis.__tw_load__(';
    source += JSON.stringify(id);
    source += ')';

    return {
      shortCircuit: true,
      format: "module",
      source,
    };
  }
`
