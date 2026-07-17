// Given a version, figure out what the release notes are so that we can use this to pre-fill the
// release notes on a GitHub release for the current version.

import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import * as url from 'node:url'

const __dirname = path.dirname(url.fileURLToPath(import.meta.url))

let version = process.argv[2] || process.env.npm_package_version
if (!version) {
  let pkgPath = path.resolve(__dirname, '../packages/vscode-tailwindcss/package.json')
  let pkg = await fs.readFile(pkgPath, 'utf8').then(JSON.parse)

  version = pkg.version
}

version = version.replace(/^v/, '')

let tagName = `v${version}`
let changelog = await fs.readFile(
  path.resolve(__dirname, '../packages/vscode-tailwindcss/CHANGELOG.md'),
  'utf8',
)
let lines = changelog.split(/\r?\n/)
let start = -1

for (let [idx, line] of lines.entries()) {
  let match = line.match(/^#{1,6}\s+(.+?)\s*$/)
  if (!match) continue

  if (match[1] === version || match[1] === tagName) {
    start = idx + 1
    break
  }
}

if (start !== -1) {
  let end = lines.findIndex((line, idx) => idx > start && /^#{1,6}\s+/.test(line))
  let notes = lines
    .slice(start, end === -1 ? undefined : end)
    .join('\n')
    .trim()

  if (notes) {
    console.log(notes)
    process.exit(0)
  }
}

console.log(`Placeholder release notes for version: ${tagName}`)
