import PackageJson from '@npmcli/package-json'
import assert from 'node:assert'
import * as path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import semver from 'semver'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

// Let `vsce` get the metadata for the extension
// Querying the marketplace API directly is not supported or recommended
let result = spawnSync(
  path.resolve(__dirname, '../../packages/vscode-tailwindcss/node_modules/.bin/vsce'),
  ['show', 'bradlc.vscode-tailwindcss', '--json'],
  { encoding: 'utf8' },
)

let metadata = JSON.parse(result.stdout)

if (!metadata) {
  console.error(result.error)
  throw new Error('Failed to get extension metadata')
}

/** @type {string[]} */
let versions = metadata.versions.map(({ version }) => version)

// Determine the latest version of the extension
let latest = versions
  .map((v) => semver.parse(v, { includePrerelease: true, loose: false }))
  .filter((v) => v !== null)
  .filter((v) => v.prerelease.length === 0)
  .sort((a, b) => b.compare(a) || b.compareBuild(a))
  .at(0)

// Require the minor version to be odd. This is done because
// the VSCode Marketplace suggests using odd numbers for
// pre-release builds and even ones for release builds
assert(latest && latest.minor % 2 === 1)

// Bump the patch version in `package.json`
let nextVersion = latest.inc('patch').format()
let pkg = await PackageJson.load('packages/vscode-tailwindcss')
await pkg.update({ version: nextVersion }).save()
