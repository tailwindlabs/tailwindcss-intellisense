import PackageJson from '@npmcli/package-json'
import assert from 'node:assert'
import semver from 'semver'

let res = await fetch('https://marketplace.visualstudio.com/_apis/public/gallery/extensionquery', {
  method: 'POST',
  headers: {
    accept: 'application/json;api-version=7.2-preview.1;excludeUrls=true',
    'content-type': 'application/json',
  },
  body: JSON.stringify({
    assetTypes: null,
    flags: 2151,
    filters: [
      {
        criteria: [{ filterType: 7, value: 'bradlc.vscode-tailwindcss' }],
        direction: 2,
        pageSize: 100,
        pageNumber: 1,
        sortBy: 0,
        sortOrder: 0,
        pagingToken: null,
      },
    ],
  }),
})

let { results } = await res.json()

/** @type {string[]} */
let versions = results[0].extensions[0].versions.map(({ version }) => version)

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
let pkg = await PackageJson.load('packages/vscode-tailwindcss/package.json')
await pkg.update({ version: nextVersion }).save()
