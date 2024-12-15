import type { DesignSystem } from '@tailwindcss/language-service/src/util/v4'

import postcss from 'postcss'
import { createJiti } from 'jiti'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { resolveCssFrom, resolveCssImports } from '../../css'
import { resolveFrom } from '../resolveFrom'
import { pathToFileURL } from '../../utils'
import type { Jiti } from 'jiti/lib/types'

const HAS_V4_IMPORT = /@import\s*(?:'tailwindcss'|"tailwindcss")/
const HAS_V4_THEME = /@theme\s*\{/

export async function isMaybeV4(css: string): Promise<boolean> {
  // Look for:
  // 1. An import of Tailwind CSS; OR
  // - @import 'tailwindcss'
  // - @import "tailwindcss"

  // 2. A theme block
  // - @theme { … }

  return HAS_V4_THEME.test(css) || HAS_V4_IMPORT.test(css)
}

let jiti: Jiti | undefined

async function importFile(id: string) {
  try {
    // Load ESM/CJS files through Node/Bun/whatever runtime is being used
    return await import(id)
  } catch {
    jiti ??= createJiti(__filename, { moduleCache: false, fsCache: false })

    // Transpile using Jiti if we can't load the file directly
    return await jiti.import(id)
  }
}

/**
 * Create a loader function that can load plugins and config files relative to
 * the CSS file that uses them. However, we don't want missing files to prevent
 * everything from working so we'll let the error handler decide how to proceed.
 */
function createLoader<T>({
  dependencies,
  legacy,
  filepath,
  onError,
}: {
  dependencies: Set<string>
  legacy: boolean
  filepath: string
  onError: (id: string, error: unknown, resourceType: string) => T
}) {
  let cacheKey = `${+Date.now()}`

  async function loadFile(id: string, base: string, resourceType: string) {
    try {
      let resolved = resolveFrom(base, id)

      dependencies.add(resolved)

      let url = pathToFileURL(resolved)
      url.searchParams.append('t', cacheKey)

      return await importFile(url.href).then((m) => m.default ?? m)
    } catch (err) {
      return onError(id, err, resourceType)
    }
  }

  if (legacy) {
    let baseDir = path.dirname(filepath)
    return (id: string) => loadFile(id, baseDir, 'module')
  }

  return async (id: string, base: string, resourceType: string) => {
    return {
      base,
      module: await loadFile(id, base, resourceType),
    }
  }
}

export async function loadDesignSystem(
  tailwindcss: any,
  filepath: string,
  css: string,
): Promise<DesignSystem | null> {
  // This isn't a v4 project
  if (!tailwindcss.__unstable__loadDesignSystem) return null

  // We don't have any theme stuff we can use
  if (!isMaybeV4(css)) {
    return null
  }

  let dependencies = new Set<string>()

  let supportsImports = false
  try {
    await tailwindcss.__unstable__loadDesignSystem(css, {
      loadStylesheet: async (id: string, base: string) => {
        supportsImports = true
        return { base, content: '' }
      },
    })
  } catch {}

  // Step 2: Use postcss to resolve `@import` rules in the CSS file
  if (!supportsImports) {
    let resolved = await resolveCssImports().process(css, { from: filepath })
    css = resolved.css
  }

  // Step 3: Take the resolved CSS and pass it to v4's `loadDesignSystem`
  let design: DesignSystem = await tailwindcss.__unstable__loadDesignSystem(css, {
    base: path.dirname(filepath),

    // v4.0.0-alpha.25+
    loadModule: createLoader({
      dependencies,
      legacy: false,
      filepath,
      onError: (id, err, resourceType) => {
        console.error(`Unable to load ${resourceType}: ${id}`, err)

        if (resourceType === 'config') {
          return {}
        } else if (resourceType === 'plugin') {
          return () => {}
        }
      },
    }),

    loadStylesheet: async (id: string, base: string) => {
      let resolved = resolveCssFrom(base, id)

      dependencies.add(resolved)

      return {
        base: path.dirname(resolved),
        content: await fs.readFile(resolved, 'utf-8'),
      }
    },

    // v4.0.0-alpha.24 and below
    loadPlugin: createLoader({
      dependencies,
      legacy: true,
      filepath,
      onError(id, err) {
        console.error(`Unable to load plugin: ${id}`, err)

        return () => {}
      },
    }),

    loadConfig: createLoader({
      dependencies,
      legacy: true,
      filepath,
      onError(id, err) {
        console.error(`Unable to load config: ${id}`, err)

        return {}
      },
    }),
  })

  // Step 4: Augment the design system with some additional APIs that the LSP needs
  Object.assign(design, {
    dependencies: () => dependencies,

    compile(classes: string[]): (postcss.Root | null)[] {
      let css = design.candidatesToCss(classes)
      let errors: any[] = []

      let roots = css.map((str) => {
        if (str === null) return postcss.root()

        try {
          return postcss.parse(str.trimEnd())
        } catch (err) {
          errors.push(err)
          return postcss.root()
        }
      })

      if (errors.length > 0) {
        console.error(JSON.stringify(errors))
      }

      return roots
    },

    toCss(nodes: postcss.Root | postcss.Node[]): string {
      return Array.isArray(nodes)
        ? postcss.root({ nodes }).toString().trim()
        : nodes.toString().trim()
    },
  })

  return design
}
