// Set the version of all published packages in the monorepo. The VS Code
// extension, the language server, and the language service are versioned
// together.
//
// Usage: node ./scripts/version-packages.mjs [version | patch | minor]
//
// Releases use an even minor version, pre-releases use an odd minor version
// and are published automatically. This means that `minor` will skip the
// pre-release line and bump to the next even minor version.
//
// When no argument is passed, your editor is opened to update the versions
// interactively.

import { spawnSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import url from 'node:url'
import prettier from 'prettier'

const __dirname = path.dirname(url.fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')

let version = process.argv[2] ?? null

// The known workspace is: vscode-tailwindcss
// The language server and the language service should always be in sync with
// the extension, so they are updated whenever the extension version changes.
const syncedWorkspaces = new Map([
  [
    'vscode-tailwindcss',
    ['packages/tailwindcss-language-server', 'packages/tailwindcss-language-service'],
  ],
])

const inverseSyncedWorkspaces = new Map()

for (let [name, paths] of syncedWorkspaces) {
  for (let [idx, filePath] of paths.entries()) {
    // Make sure all the paths are absolute paths
    paths[idx] = path.resolve(root, filePath, 'package.json')

    // Make sure inverse lookup table exists
    inverseSyncedWorkspaces.set(paths[idx], name)
  }
}

// Track all the public workspaces
let workspaces = new Map()

for (let entry of await fs.readdir(path.resolve(root, 'packages'))) {
  let pkgPath = path.resolve(root, 'packages', entry, 'package.json')
  let pkg = await fs.readFile(pkgPath, 'utf8').then(JSON.parse)
  if (pkg.private) continue

  workspaces.set(pkg.name, { version: pkg.version ?? '', path: pkgPath })
}

function resolveVersion(current, input) {
  input = input.replace(/^v/, '')

  if (/^\d+\.\d+\.\d+(-.+)?$/.test(input)) return input

  let [major, minor, patch] = current.split('.').map(Number)

  switch (input) {
    case 'patch':
      return `${major}.${minor}.${patch + 1}`

    // Releases use an even minor version, so skip the odd pre-release line
    case 'minor':
      return `${major}.${minor + 2 - (minor % 2)}.0`

    default:
      console.error(`Invalid version: ${input}`)
      console.error('Expected an explicit version, `patch` or `minor`')
      process.exit(1)
  }
}

async function updatePackage(pkgPath, version) {
  let pkg = await fs.readFile(pkgPath, 'utf8').then(JSON.parse)
  let name = pkg.name

  // Ensure the version is set after the name and before everything else
  delete pkg.name
  delete pkg.version
  pkg = { name, version, ...pkg }

  await fs.writeFile(
    pkgPath,
    await prettier
      .format(JSON.stringify(pkg, null, 2), { filepath: pkgPath })
      .then((x) => `${x.trim()}\n`),
  )

  console.log(`${name}@${version}`)
}

if (version !== null) {
  // The published packages are versioned in lockstep, so resolve `patch` and
  // `minor` against the extension version
  version = resolveVersion(workspaces.get('vscode-tailwindcss').version, version)

  for (let { path: pkgPath } of workspaces.values()) {
    await updatePackage(pkgPath, version)
  }
} else {
  // Workspaces that are in sync with another workspace should not be updated
  // manually, they should be updated by updating the main workspace.
  let editableWorkspaces = [...workspaces].filter(
    ([, info]) => !inverseSyncedWorkspaces.has(info.path),
  )

  // Build the editable output
  let lines = [
    '# Update the versions of the packages you want to change',
    '# Use an explicit version, or one of: patch or minor',
    '',
  ]
  for (let [name, info] of editableWorkspaces) {
    lines.push(`${name}: ${info.version}`)
  }

  // Figure out which editor to use.
  //
  // In this case we still split on whitespace, because it can happen that the
  // EDITOR env variable is configured as `code --wait`. This means that we
  // want `code` as the editor, but `--wait` is one of the arguments.
  let args = (process.env.EDITOR ?? 'vi').split(' ')
  let editor = args.shift()

  // Create a temporary file which will be edited
  let filepath = path.resolve(tmpdir(), `version-${randomUUID()}.txt`)
  await fs.writeFile(filepath, lines.join('\n'))

  // Edit the file, once the editor is closed, the file will be saved and we
  // can read the changes
  spawnSync(editor, [...args, filepath], {
    stdio: 'inherit',
  })

  let newOutput = await fs.readFile(filepath, 'utf8').then((x) => x.trim().split('\n'))

  // Cleanup temporary file
  await fs.unlink(filepath)

  // Update the package.json files
  for (let line of newOutput) {
    if (line[0] === '#') continue // Skip comment lines
    if (line.trim() === '') continue // Skip empty lines

    let [name, version = ''] = line.split(':').map((x) => x.trim())
    if (version === '') continue
    if (!workspaces.has(name)) continue

    version = resolveVersion(workspaces.get(name).version, version)

    // Figure out all the paths to the package.json files that need to be
    // updated with the new version
    let paths = [
      // The package.json file of the main workspace
      workspaces.get(name).path,

      // The package.json files of the workspaces that are in sync with the
      // main workspace
      ...(syncedWorkspaces.get(name) ?? []),
    ]

    for (let pkgPath of paths) {
      await updatePackage(pkgPath, version)
    }
  }
}

console.log('Done.')
