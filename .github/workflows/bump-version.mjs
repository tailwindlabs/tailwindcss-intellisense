import * as fs from 'node:fs/promises'
import assert from 'node:assert'
import semver from 'semver'

/**
 * @param {string[]} versions
 * @returns {semver.SemVer}
 */
function latestSemver(versions) {
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

  return latest
}

async function bumpVersion() {
  let res = await fetch(
    'https://marketplace.visualstudio.com/_apis/public/gallery/extensionquery',
    {
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
    }
  )
  let { results } = await res.json()
  let versions = results[0].extensions[0].versions.map(({ version }) => version)
  let latest = latestSemver(versions)
  let nextVersion = latest.inc('patch').format()

  let pkgFilename = 'packages/vscode-tailwindcss/package.json'
  let pkg = JSON.parse(await fs.readFile(pkgFilename, 'utf8'))
  await fs.writeFile(
    pkgFilename,
    JSON.stringify({ ...pkg, version: nextVersion }, null, 2) + '\n',
    'utf8'
  )
}

bumpVersion()
