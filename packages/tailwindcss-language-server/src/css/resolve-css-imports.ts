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
    resolve(id, basedir) {
      let paths = resolver.resolveSync({}, basedir, id)
      return paths ? paths : id
    },
  }),
  fixRelativePaths(),
])

export function resolveCssImports() {
  return resolveImports
}
