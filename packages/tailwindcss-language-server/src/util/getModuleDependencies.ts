// https://github.com/tailwindlabs/tailwindcss/blob/bac5ecf0040aa9a788d1b22d706506146ee831ff/src/lib/getModuleDependencies.js
import fs from 'fs'
import path from 'path'
import normalizePath from 'normalize-path'

let jsExtensions = ['.js', '.cjs', '.mjs']

// Given the current file `a.ts`, we want to make sure that when importing `b` that we resolve
// `b.ts` before `b.js`
//
// E.g.:
//
// a.ts
//   b // .ts
//   c // .ts
// a.js
//   b // .js or .ts

let jsResolutionOrder = ['', '.js', '.cjs', '.mjs', '.ts', '.cts', '.mts', '.jsx', '.tsx']
let tsResolutionOrder = ['', '.ts', '.cts', '.mts', '.tsx', '.js', '.cjs', '.mjs', '.jsx']

function resolveWithExtension(file: string, extensions: string[]): string | null {
  // Try to find `./a.ts`, `./a.ts`, ... from `./a`
  for (let ext of extensions) {
    let full = `${file}${ext}`
    if (fs.existsSync(full) && fs.statSync(full).isFile()) {
      return full
    }
  }

  // Try to find `./a/index.js` from `./a`
  for (let ext of extensions) {
    let full = `${file}/index${ext}`
    if (fs.existsSync(full)) {
      return full
    }
  }

  return null
}

function* _getModuleDependencies(
  filename: string,
  base: string,
  seen: Set<string>,
  ext = path.extname(filename),
): Generator<string> {
  // Try to find the file
  let absoluteFile = resolveWithExtension(
    path.resolve(base, filename),
    jsExtensions.includes(ext) ? jsResolutionOrder : tsResolutionOrder,
  )
  if (absoluteFile === null) return // File doesn't exist

  // Prevent infinite loops when there are circular dependencies
  if (seen.has(absoluteFile)) return // Already seen
  seen.add(absoluteFile)

  // Mark the file as a dependency
  yield absoluteFile

  // Resolve new base for new imports/requires
  base = path.dirname(absoluteFile)
  ext = path.extname(absoluteFile)

  let contents = fs.readFileSync(absoluteFile, 'utf-8')

  // Find imports/requires
  for (let match of [
    ...contents.matchAll(/import[\s\S]*?['"](.{3,}?)['"]/gi),
    ...contents.matchAll(/import[\s\S]*from[\s\S]*?['"](.{3,}?)['"]/gi),
    ...contents.matchAll(/require\(['"`](.+)['"`]\)/gi),
  ]) {
    // Bail out if it's not a relative file
    if (!match[1].startsWith('.')) continue

    yield* _getModuleDependencies(match[1], base, seen, ext)
  }
}

export function getModuleDependencies(absoluteFilePath: string): string[] {
  return Array.from(
    _getModuleDependencies(absoluteFilePath, path.dirname(absoluteFilePath), new Set()),
  )
    .filter((file) => file !== absoluteFilePath)
    .map((file) => normalizePath(file))
}
