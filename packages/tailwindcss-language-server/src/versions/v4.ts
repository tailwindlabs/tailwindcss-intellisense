import type { Api, ClassEntry } from '@tailwindcss/language-service/src/api'
import type { DesignSystem, VariantEntry } from '@tailwindcss/language-service/src/util/v4'
import postcss from 'postcss'
import postcssImport from 'postcss-import'
import { bigSign } from './utils'
import { colorsInRoot, optimizeColorMix } from './color'
import type { TailwindCssSettings } from '@tailwindcss/language-service/src/util/state'

type MaybeClassEntry = ClassEntry | null

export class Version4 implements Api {
  static async load(settings: TailwindCssSettings, mod: any, filepath: string, css: string) {
    // This isn't a v4 project
    if (!mod.__unstable__loadDesignSystem) return null

    // We don't have any theme stuff we can use
    if (!isMaybeV4(css)) return null

    // Step 2: Use postcss to resolve `@import` rules in the CSS file
    // TODO: What if someone is actively editing their config and introduces a syntax error?
    // We don't want to necessarily throw away the knowledge that we have a v4 project.
    let resolveImports = postcss([postcssImport()])
    let resolved = await resolveImports.process(css, { from: filepath })

    // Step 3: Take the resolved CSS and pass it to v4's `loadDesignSystem`
    let design = mod.__unstable__loadDesignSystem(resolved.css)

    return new Version4(settings, mod, design)
  }

  private constructor(
    private readonly settings: TailwindCssSettings,
    private readonly mod: any,
    private readonly design: DesignSystem,
  ) {}

  get version() {
    return '4.0.0-alpha.1'
  }

  get features() {
    return []
  }

  private classes: ClassEntry[] = []
  private classCache: Record<string, MaybeClassEntry> = {}

  async prepare() {
    // 1. Load the list of known classes
    let classList = this.design.getClassList()

    // 2. Get information on every class
    let entries = await this.queryClasses(classList.map(([name]) => name))

    // 3. Populate known modifiers
    for (let [idx, [, meta]] of classList.entries()) {
      let entry = entries[idx]
      if (!entry) continue
      Object.assign(entry!, {
        modifiers: meta.modifiers ?? [],
      })
    }

    // 4. Populate the known class list
    this.classes = entries.filter((entry): entry is ClassEntry => entry !== null)
  }

  async queryClasses(classes: string[]) {
    // Ask about classes we haven't cached yet
    let uncached = classes.filter((name) => this.classCache[name] === undefined)
    let results = await this.compileClasses(uncached)

    // Populate the cache with the results
    for (let [idx, name] of uncached.entries()) {
      let entry = results[idx]
      if (!entry) continue
      this.classCache[name] = entry
    }

    // Return the results
    return classes.map((name) => this.classCache[name] ?? null)
  }

  async queryProperties(properties: string[]) {
    return []
  }

  async searchClasses(query: string) {
    return this.classes
  }

  async searchProperties(query: string) {
    return []
  }

  async sort(classes: string[]) {
    return this.design
      .getClassOrder(classes)
      .sort(([, a], [, z]) => {
        if (a === z) return 0
        if (a === null) return -1
        if (z === null) return 1
        return bigSign(a - z)
      })
      .map(([className]) => className)
  }

  async conflicts(classes: string[]) {
    return []
  }

  private async compileClasses(list: string[]): Promise<MaybeClassEntry[]> {
    // 1. Populate the `css` string for each class
    let css = this.design.candidatesToCss(list)

    // 2. Parse each of the classes into a PostCSS Root
    let roots = css.map((str) => {
      if (!str) return postcss.root()
      return postcss.parse(str, { from: 'input.css' })
    })

    // 3. Downlevel `color-mix` syntax where possible
    roots.forEach((root) => {
      root.walkDecls((decl) => {
        decl.value = optimizeColorMix(decl.value)
      })
    })

    // 4. Add color and pixel equivalents to each class
    let processor = postcss([
      // todo:
      // addEquivalents(this.settings),
      // todo:
      // removeAtPropertyRules(),
    ])

    roots = await Promise.all(
      roots.map(async (root) => {
        let result = await processor.process(root, { from: 'input.css' })
        return result.root
      }),
    )

    // 4. Find every color generated on a per-class basis
    let colors = roots.map(colorsInRoot)

    // 5. Turn the list of classes into a list of ClassEntry objects
    return list.map((name, idx) => {
      if (css[idx] === null) return null

      return {
        kind: 'class',
        name,
        variants: [],
        root: roots[idx],
        colors: colors[idx],
        modifiers: [],
        apply: { allowed: true },
      }
    })
  }
}

const HAS_V4_IMPORT = /@import\s*(?:'tailwindcss(\/[^']+)?'|"tailwindcss(\/[^"]+)?")/
const HAS_V4_THEME = /@theme\s*\{/

async function isMaybeV4(css: string): Promise<boolean> {
  // Look for:
  // 1. An import of Tailwind CSS; OR
  // - @import 'tailwindcss'
  // - @import "tailwindcss"

  // 2. A theme block
  // - @theme { … }

  return HAS_V4_THEME.test(css) || HAS_V4_IMPORT.test(css)
}
