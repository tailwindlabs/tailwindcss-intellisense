import type {
  ClassEntry,
  ClassMetadata,
  DesignSystem,
} from '@tailwindcss/language-service/src/util/v4'

import postcss from 'postcss'
import { createJiti } from 'jiti'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { resolveCssImports } from '../../css'
import { Resolver } from '../../resolver'
import { pathToFileURL } from '../../utils'
import type { Jiti } from 'jiti/lib/types'
import { assets } from './assets'

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
  dependencies,
  legacy,
  jiti,
  filepath,
  resolver,
  onError,
}: {
  dependencies: Set<string>
  legacy: boolean
  jiti: Jiti
  filepath: string
  resolver: Resolver
  onError: (id: string, error: unknown, resourceType: string) => T
}) {
  let cacheKey = `${+Date.now()}`

  async function loadFile(id: string, base: string, resourceType: string) {
    try {
      let resolved = await resolver.resolveJsId(id, base)

      dependencies.add(resolved)

      let url = pathToFileURL(resolved)
      url.searchParams.append('t', cacheKey)

      return await jiti.import(url.href, { default: true })
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

interface Source {
  filepath: string
  content: string
}

export async function loadDesignSystem(
  resolver: Resolver,
  tailwindcss: any,
  filepath: string,
  css: string,
  isFallback: boolean,
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
    let resolved = await resolveCssImports({ resolver }).process(css, { from: filepath })
    css = resolved.css
  }

  // Create a Jiti instance that can be used to load plugins and config files
  let jiti = createJiti(__filename, {
    moduleCache: false,
    fsCache: false,
  })

  let sources: Source[] = [{ filepath: '', content: css }]

  // Step 3: Take the resolved CSS and pass it to v4's `loadDesignSystem`
  let design: DesignSystem = await tailwindcss.__unstable__loadDesignSystem(css, {
    base: path.dirname(filepath),

    // v4.0.0-alpha.25+
    loadModule: createLoader({
      dependencies,
      legacy: false,
      jiti,
      filepath,
      resolver,
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
      // Skip over missing stylesheets (and log an error) so we can do our best
      // to compile the design system even when the build might be incomplete.
      // TODO: Figure out if we can recover from parsing errors in stylesheets
      // we'd want to surface diagnostics when we discover imports that cause
      // parsing errors or other logic errors.

      try {
        let resolved = await resolver.resolveCssId(id, base)

        dependencies.add(resolved)

        let content = await fs.readFile(resolved, 'utf-8')

        sources.push({ filepath: resolved, content })

        return {
          base: path.dirname(resolved),
          content,
        }
      } catch (err) {
        if (isFallback && id in assets) {
          console.error(`Loading fallback stylesheet for: ${id}`)

          return { base, content: assets[id] }
        }

        console.error(`Unable to load stylesheet: ${id}`, err)
        return { base, content: '' }
      }
    },

    // v4.0.0-alpha.24 and below
    loadPlugin: createLoader({
      dependencies,
      legacy: true,
      jiti,
      filepath,
      resolver,
      onError(id, err) {
        console.error(`Unable to load plugin: ${id}`, err)

        return () => {}
      },
    }),

    loadConfig: createLoader({
      dependencies,
      legacy: true,
      jiti,
      filepath,
      resolver,
      onError(id, err) {
        console.error(`Unable to load config: ${id}`, err)

        return {}
      },
    }),
  })

  // Step 4: Collect custom classes from the AST
  let start = process.hrtime.bigint()
  let customClasses = collectCustomClasses(sources)
  let elapsed = process.hrtime.bigint() - start
  console.log(`Collected custom classes in ${Number(elapsed) / 1e6}ms`)

  // Step 5: Augment the design system with some additional APIs that the LSP needs
  Object.assign(design, {
    dependencies: () => dependencies,

    compile(classes: string[]): (postcss.Root | null)[] {
      let css = design.candidatesToCss(classes)
      let errors: any[] = []

      let roots = css.map((str, idx) => {
        if (str === null) {
          let className = classes[idx]

          for (let customClass of customClasses) {
            if (customClass[0] === className) {
              // @ts-ignore
              return customClass[1].root
            }
          }

          return postcss.root()
        }

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

    getCustomClassList: () => customClasses,
  })

  return design
}

import selectorParser from 'postcss-selector-parser'

function collectCustomClasses(sources: Source[]): ClassEntry[] {
  let parser = selectorParser()

  let customClasses: Record<string, Set<postcss.Root>> = {}

  for (let source of sources) {
    postcss.parse(source.content).walkRules((rule) => {
      let root: postcss.Root | null = null

      parser.astSync(rule.selector).walk((node) => {
        if (node.type !== 'class') return

        root ??= isolate(rule)
        if (!root) return

        customClasses[node.value] ??= new Set()
        customClasses[node.value].add(root)
      })
    })
  }

  let entries: ClassEntry[] = []

  for (let [className, roots] of Object.entries(customClasses)) {
    entries.push([
      className,
      {
        modifiers: [],
        // @ts-ignore
        root: postcss.root({
          nodes: Array.from(roots, (root) => root.clone().nodes).flat(),
        }),
      },
    ])
  }

  return entries
}

function isolate(node: postcss.Node): postcss.Root | null {
  let current = node
  let tmp = node.clone()

  while (current.type !== 'root' && current.parent) {
    tmp = current.parent.clone({
      nodes: [tmp as any],
      raws: {},
    })

    current = current.parent
  }

  if (tmp.type !== 'root') return null

  return tmp as postcss.Root
}
