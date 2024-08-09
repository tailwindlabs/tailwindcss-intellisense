import postcss from 'postcss'
import postcssImport from 'postcss-import'
import { createResolver } from './util/resolve'

import path from 'node:path'
import type { AtRule, Plugin } from 'postcss'

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
  fixRelativePathsPlugin(),
])

export function resolveCssImports() {
  return resolveImports
}

const SINGLE_QUOTE = "'"
const DOUBLE_QUOTE = '"'

export default function fixRelativePathsPlugin(): Plugin {
  // Retain a list of touched at-rules to avoid infinite loops
  let touched: WeakSet<AtRule> = new WeakSet()

  function fixRelativePath(atRule: AtRule) {
    let rootPath = atRule.root().source?.input.file
    if (!rootPath) {
      return
    }

    let inputFilePath = atRule.source?.input.file
    if (!inputFilePath) {
      return
    }

    if (touched.has(atRule)) {
      return
    }

    let value = atRule.params[0]

    let quote =
      value[0] === DOUBLE_QUOTE && value[value.length - 1] === DOUBLE_QUOTE
        ? DOUBLE_QUOTE
        : value[0] === SINGLE_QUOTE && value[value.length - 1] === SINGLE_QUOTE
          ? SINGLE_QUOTE
          : null
    if (!quote) {
      return
    }
    let glob = atRule.params.slice(1, -1)

    // Handle eventual negative rules. We only support one level of negation.
    let negativePrefix = ''
    if (glob.startsWith('!')) {
      glob = glob.slice(1)
      negativePrefix = '!'
    }

    // We only want to rewrite relative paths.
    if (!glob.startsWith('./') && !glob.startsWith('../')) {
      return
    }

    let absoluteGlob = path.posix.join(normalizePath(path.dirname(inputFilePath)), glob)
    let absoluteRootPosixPath = path.posix.dirname(normalizePath(rootPath))

    let relative = path.posix.relative(absoluteRootPosixPath, absoluteGlob)

    // If the path points to a file in the same directory, `path.relative` will
    // remove the leading `./` and we need to add it back in order to still
    // consider the path relative
    if (!relative.startsWith('.')) {
      relative = './' + relative
    }

    atRule.params = quote + negativePrefix + relative + quote
    touched.add(atRule)
  }

  return {
    postcssPlugin: 'tailwindcss-postcss-fix-relative-paths',
    AtRule: {
      source: fixRelativePath,
      plugin: fixRelativePath,
    },
  }
}

// Inlined version of `normalize-path` <https://github.com/jonschlinkert/normalize-path>
// Copyright (c) 2014-2018, Jon Schlinkert.
// Released under the MIT License.
function normalizePathBase(path: string, stripTrailing?: boolean) {
  if (typeof path !== 'string') {
    throw new TypeError('expected path to be a string')
  }

  if (path === '\\' || path === '/') return '/'

  var len = path.length
  if (len <= 1) return path

  // ensure that win32 namespaces has two leading slashes, so that the path is
  // handled properly by the win32 version of path.parse() after being normalized
  // https://msdn.microsoft.com/library/windows/desktop/aa365247(v=vs.85).aspx#namespaces
  var prefix = ''
  if (len > 4 && path[3] === '\\') {
    var ch = path[2]
    if ((ch === '?' || ch === '.') && path.slice(0, 2) === '\\\\') {
      path = path.slice(2)
      prefix = '//'
    }
  }

  var segs = path.split(/[/\\]+/)
  if (stripTrailing !== false && segs[segs.length - 1] === '') {
    segs.pop()
  }
  return prefix + segs.join('/')
}

export function normalizePath(originalPath: string) {
  let normalized = normalizePathBase(originalPath)

  // Make sure Windows network share paths are normalized properly
  // They have to begin with two slashes or they won't resolve correctly
  if (
    originalPath.startsWith('\\\\') &&
    normalized.startsWith('/') &&
    !normalized.startsWith('//')
  ) {
    return `/${normalized}`
  }

  return normalized
}
