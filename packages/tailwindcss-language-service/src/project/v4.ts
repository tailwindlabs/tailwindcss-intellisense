import { supportedFeatures } from '../features'
import { DesignSystem } from '../util/v4'
import { Project } from './project'
import { ResolvedClass } from './tokens'
import { bigSign } from '../util/big-sign'
import { lazy } from '../util/lazy'
import { segment } from '../util/segment'
import * as CSS from '../css/parse'
import { colorsInAst } from '../util/color'
import { AstNode } from '../css/ast'
import { mayContainColors } from './color'

export interface ProjectDescriptorV4 {
  kind: 'v4'

  /**
   * The version of Tailwind CSS in use
   */
  version: string

  /**
   * The module returned by import("tailwindcss")
   */
  tailwindcss: unknown

  /**
   * The design system returned by `__unstable_loadDesignSystem(…)`
   */
  design: DesignSystem
}

export async function createProjectV4(desc: ProjectDescriptorV4): Promise<Project> {
  let classCache = new Map<string, ResolvedClass>()
  let modifierCache = new Map<string, string[]>()

  async function resolveClasses(classes: string[]) {
    // Compile anything not in the cache
    let uncached = classes.filter((className) => !classCache.has(className))
    let results = compileClasses(uncached)

    // Populate the class cache
    for (let result of results) classCache.set(result.name, result)

    // Collect the results in order
    let resolved = classes.map((name) => classCache.get(name) ?? null)

    // Remove unknown classes from the cache otherwise these jsut waste memory
    for (let result of results) {
      if (result.source !== 'unknown') continue
      classCache.delete(result.name)
    }

    return resolved
  }

  function compileClasses(classes: string[]): ResolvedClass[] {
    let errors: any[] = []

    let css = desc.design.candidatesToCss(classes)

    let parsed = css.map((str) =>
      lazy(() => {
        let ast: AstNode[] = []
        let colors: ReturnType<typeof colorsInAst> = []

        if (str) {
          try {
            ast = CSS.parse(str)
            colors = colorsInAst(state, ast)
          } catch (err) {
            errors.push(err)
          }
        }

        return { ast, colors }
      }),
    )

    if (errors.length > 0) {
      console.error(JSON.stringify(errors))
    }

    return classes.map((name, idx) => ({
      kind: 'class',
      source: css[idx] ? 'generated' : 'unknown',
      name,
      variants: css[idx] ? segment(name, ':').slice(0, -1) : [],
      modifiers: modifierCache.get(name) ?? [],
      apply: css[idx] ? { allowed: true } : { allowed: false, reason: 'class does not exist' },
      nodes: () => parsed[idx]().ast,
      colors: (force?: boolean) => {
        let res = parsed[idx]
        if (res.status === 'pending' && !force) {
          return []
        }

        return parsed[idx]().colors
      },
    }))
  }

  async function sortClasses(classes: string[]) {
    return desc.design
      .getClassOrder(classes)
      .sort(([, a], [, z]) => {
        if (a === z) return 0
        if (a === null) return -1
        if (z === null) return 1
        return bigSign(a - z)
      })
      .map(([className]) => className)
  }

  let classList = desc.design.getClassList()

  for (let [className, meta] of classList) {
    modifierCache.set(className, meta.modifiers)
  }

  // Pre-compute color values
  let state = { designSystem: desc.design } as any
  let colors = classList.map((entry) => entry[0]).filter(mayContainColors)
  let resolved = await resolveClasses(colors)
  for (let cls of resolved) cls.colors(true)

  return {
    version: desc.version,
    features: supportedFeatures(desc.version, desc.tailwindcss),
    depdendencies: [],

    sources: () => [],

    resolveClasses,
    resolveDesignTokens: async () => [],
    resolveVariants: async () => [],

    searchClasses: async () => [],
    searchDesignTokens: async () => [],
    searchVariants: async () => [],

    sortClasses,
  }
}
