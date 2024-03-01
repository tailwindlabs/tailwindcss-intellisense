import type { DesignSystem } from 'tailwindcss-language-service/src/util/v4'

import postcss from 'postcss'
import postcssImport from 'postcss-import'

const resolveImports = postcss([postcssImport()])

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

export async function loadDesignSystem(
  tailwindcss: any,
  filepath: string,
  css: string
): Promise<DesignSystem | null> {
  // This isn't a v4 project
  if (!tailwindcss.loadDesignSystem) return null

  // We don't have any theme stuff we can use
  if (!isMaybeV4(css)) {
    return null
  }

  // Step 2: Use postcss to resolve `@import` rules in the CSS file
  // TODO: What if someone is actively editing their config and introduces a syntax error?
  // We don't want to necessarily throw away the knowledge that we have a v4 project.
  let resolved = await resolveImports.process(css, { from: filepath })

  // Step 3: Take the resolved CSS and pass it to v4's `loadDesignSystem`
  let design = tailwindcss.loadDesignSystem(resolved.css)

  // Step 4: Augment the design system with some additional APIs that the LSP needs
  Object.assign(design, {
    optimizeCss(css: string) {
      return tailwindcss.optimizeCss(css)
    },

    compile(classes: string[]): postcss.Root {
      let parsed = tailwindcss.parse(classes, design, { throwOnInvalid: false })
      let result: string = tailwindcss.toCss(parsed.astNodes)

      return postcss.parse(result)
    },

    toCss(nodes: postcss.Root | postcss.Node[]): string {
      return Array.isArray(nodes)
        ? postcss.root({ nodes }).toString()
        : nodes.toString()
    },
  })

  return design
}
