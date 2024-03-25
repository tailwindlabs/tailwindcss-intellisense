import postcss from 'postcss'
import postcssImport from 'postcss-import'

const resolveImports = postcss([postcssImport()])

export function resolveCssImports() {
  return resolveImports
}
