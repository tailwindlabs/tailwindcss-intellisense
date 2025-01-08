import * as fs from 'node:fs/promises'
import postcss from 'postcss'
import postcssImport from 'postcss-import'
import { fixRelativePaths } from './fix-relative-paths'
import { Resolver } from '../resolver'

export function resolveCssImports({
  resolver,
  loose = false,
}: {
  resolver: Resolver
  loose?: boolean
}) {
  return postcss([
    // Hoist imports to the top of the file
    {
      postcssPlugin: 'hoist-at-import',
      Once(root, { result }) {
        if (!loose) return

        let hoist: postcss.AtRule[] = []
        let seenImportsAfterOtherNodes = false

        for (let node of root.nodes) {
          if (node.type === 'atrule' && (node.name === 'import' || node.name === 'charset')) {
            hoist.push(node)
          } else if (hoist.length > 0 && (node.type === 'atrule' || node.type === 'rule')) {
            seenImportsAfterOtherNodes = true
          }
        }

        root.prepend(hoist)

        if (!seenImportsAfterOtherNodes) return

        console.log(
          `hoist-at-import: The file '${result.opts.from}' contains @import rules after other at rules. This is invalid CSS and may cause problems with your build.`,
        )
      },
    },

    postcssImport({
      async resolve(id, base) {
        try {
          return await resolver.resolveCssId(id, base)
        } catch (e) {
          // TODO: Need to test this on windows
          return `/virtual:missing/${id}`
        }
      },

      load(filepath) {
        if (filepath.startsWith('/virtual:missing/')) {
          return Promise.resolve('')
        }

        return fs.readFile(filepath, 'utf-8')
      },
    }),
    fixRelativePaths(),
  ])
}
