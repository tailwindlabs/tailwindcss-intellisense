import latestSemver from 'latest-semver'
import * as fs from 'fs/promises'
import assert from 'assert'

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
  let parts = latest.split('.')

  assert(Number(parts[1]) % 2 === 1)

  let nextVersion = `${parts[0]}.${parts[1]}.${Number(parts[2]) + 1}`
  let pkgFilename = 'packages/vscode-tailwindcss/package.json'
  let pkg = JSON.parse(await fs.readFile(pkgFilename, 'utf8'))
  await fs.writeFile(pkgFilename, JSON.stringify({ ...pkg, version: nextVersion }, null, 2), 'utf8')
}

bumpVersion()
