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
  // Replace `@reference "…"` with `@import "…" reference`
  {
    postcssPlugin: 'replace-at-reference',
    Once(root) {
      root.walkAtRules('reference', (atRule) => {
        atRule.name = 'import'
        atRule.params += ' reference'
      })
    },
  },
  postcssImport({
    resolve: (id, base) => resolveCssFrom(base, id),
  }),
  fixRelativePaths(),
])

export function resolveCssImports() {
  return resolveImports
}

export function resolveCssFrom(base: string, id: string) {
  return resolver.resolveSync({}, base, id) || id
}
