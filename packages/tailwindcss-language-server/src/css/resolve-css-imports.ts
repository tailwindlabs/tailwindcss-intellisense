import * as fs from 'node:fs/promises'
import postcss from 'postcss'
import postcssImport from 'postcss-import'
import { fixRelativePaths } from './fix-relative-paths'
import { Resolver } from '../resolver'

export function resolveCssImports({
  resolver,
}: {
  resolver: Resolver
}) {
  return postcss([
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
