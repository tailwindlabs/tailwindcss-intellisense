import postcss from 'postcss'
import postcssImport from 'postcss-import'
import { createResolver } from './util/resolve'

const resolver = createResolver({
  extensions: ['.css'],
  conditionNames: ['style'],
})

const resolveImports = postcss([
  postcssImport({
    resolve(id, basedir) {
      let paths = resolver.resolveSync({}, basedir, id)
      return paths
        ? paths
        : id
    },
  }),
])

export function resolveCssImports() {
  return resolveImports
}
