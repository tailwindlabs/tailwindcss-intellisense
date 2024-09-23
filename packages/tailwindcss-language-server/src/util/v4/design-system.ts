import type { DesignSystem } from '@tailwindcss/language-service/src/util/v4'

import postcss from 'postcss'
import * as path from 'node:path'
import { resolveCssImports } from '../../css'
import { resolveFrom } from '../resolveFrom'
import { pathToFileURL } from 'tailwindcss-language-server/src/utils'

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

/**
 * Create a loader function that can load plugins and config files relative to
 * the CSS file that uses them. However, we don't want missing files to prevent
 * everything from working so we'll let the error handler decide how to proceed.
 */
function createLoader<T>({
  filepath,
  onError,
}: {
  filepath: string
  onError: (id: string, error: unknown, resourceType: string) => T
}) {
  let cacheKey = `${+Date.now()}`

  async function loadFile(id: string, base: string, resourceType: string) {
    try {
      let resolved = resolveFrom(base, id)

      let url = pathToFileURL(resolved)
      url.searchParams.append('t', cacheKey)

      return await import(url.href).then((m) => m.default ?? m)
    } catch (err) {
      return onError(id, err, resourceType)
    }
  }

  let baseDir = path.dirname(filepath)
  return (id: string) => loadFile(id, baseDir, 'module')
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

  // Step 2: Use postcss to resolve `@import` rules in the CSS file
  // TODO: What if someone is actively editing their config and introduces a syntax error?
  // We don't want to necessarily throw away the knowledge that we have a v4 project.
  let resolved = await resolveCssImports().process(css, { from: filepath })

  // Step 3: Take the resolved CSS and pass it to v4's `loadDesignSystem`
  let design: DesignSystem = await tailwindcss.__unstable__loadDesignSystem(resolved.css, {
    loadPlugin: createLoader({
      filepath,
      onError(id, err) {
        console.error(`Unable to load plugin: ${id}`, err)

        return () => {}
      },
    }),

    loadConfig: createLoader({
      filepath,
      onError(id, err) {
        console.error(`Unable to load config: ${id}`, err)

        return {}
      },
    }),
  })

  // Step 4: Augment the design system with some additional APIs that the LSP needs
  Object.assign(design, {
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
