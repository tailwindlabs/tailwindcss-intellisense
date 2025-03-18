import { exec } from 'node:child_process'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { fdir } from 'fdir'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const root = path.resolve(__dirname, '..')

const fixtures = new fdir()
  .withFullPaths()
  .globWithOptions([`tests/fixtures/*/package.json`, `tests/fixtures/v4/*/package.json`], {
    strictSlashes: true,
    contains: true,
  })
  .crawl(path.resolve(root, 'tests'))
  .sync()

const execAsync = promisify(exec)

await Promise.all(
  fixtures.map(async (fixture) => {
    console.log(`Installing dependencies for ${path.relative(root, fixture)}`)

    await execAsync('npm install', { cwd: path.dirname(fixture) })
  }),
)
