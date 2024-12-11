import * as fs from 'node:fs/promises'
import postcss from 'postcss'
import postcssImport from 'postcss-import'
import { createResolver } from '../util/resolve'
import { fixRelativePaths } from './fix-relative-paths'

const resolver = createResolver({
  extensions: ['.css'],
  mainFields: ['style'],
  conditionNames: ['style'],
})

const resolveImports = postcss([
  postcssImport({
    resolve(id, base) {
      try {
        return resolveCssFrom(base, id)
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

export function resolveCssImports() {
  return resolveImports
}

export function resolveCssFrom(base: string, id: string) {
  return resolver.resolveSync({}, base, id) || id
}
