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
  let resolved = await resolveImports.process(css, { from: filepath })

  // Step 3: Take the resolved CSS and pass it to v4's `loadDesignSystem`
  let design = tailwindcss.__unstable__loadDesignSystem(resolved.css)

  // Step 4: Augment the design system with some additional APIs that the LSP needs
  Object.assign(design, {
    optimizeCss(css: string) {
      return tailwindcss.optimizeCss(css)
    },

    compile(classes: string[]): postcss.Root[] {
      let css = design.candidatesToCss(classes) as (string | null)[]

      // Downlevel syntax
      // TODO: Either don't downlevel nesting or make `recordClassDetails` more robust
      // css = css.map((str) => {
      //   if (!str) return null
      //   try {
      //     return tailwindcss.optimizeCss(str)
      //   } catch {}
      //   return str
      // })

      // TODO: Formatting with prettier would be preferable, but it's too slow
      // Need to figure out why and if we can make it faster
      let roots = css.map((str) => {
        if (str === null) return postcss.root()

        let result = ''
        for (let i = 0; i < str.length; ++i) {
          if (str[i] === '\\') {
            result += str[i] + str[i + 1]
            i += 1
          } else if (str[i] === '"') {
            let end = str.indexOf('"', i + 1)
            result += str.slice(i, end + 1)
            i = end
          } else if (str[i] === "'") {
            let end = str.indexOf("'", i + 1)
            result += str.slice(i, end + 1)
            i = end
          } else if (str[i] === '{') {
            result += ' {\n'
          } else if (str[i] === '}') {
            result += '}\n'
          } else if (str[i] === ';') {
            result += ';\n'
          } else if (str[i] === ':') {
            let prev = str.charCodeAt(i - 1)
            if (
              (prev >= 65 && prev <= 90) ||
              (prev >= 97 && prev <= 122) ||
              (prev >= 48 && prev <= 57)
            ) {
              result += ': '
            } else {
              result += ':'
            }
          } else {
            result += str[i]
          }
        }

        let lines = result.split('\n')

        let depth = 0

        for (let i = 0; i < lines.length; ++i) {
          let line = lines[i]
          if (line.includes('}')) depth--
          let indent = '    '.repeat(Math.max(0, depth))
          lines[i] = indent + line
          if (line.includes('{')) depth++
        }

        let pretty = lines.join('\n').trim()

        try {
          return postcss.parse(pretty)
        } catch {
          return postcss.parse(str)
        }
      })

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
