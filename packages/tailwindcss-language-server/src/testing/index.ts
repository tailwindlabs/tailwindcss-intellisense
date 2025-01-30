import { afterAll, onTestFinished, test, TestOptions } from 'vitest'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import * as proc from 'node:child_process'
import dedent from 'dedent'

export interface TestUtils {
  /** The "cwd" for this test */
  root: string
}

export interface Storage {
  /** A list of files and their content */
  [filePath: string]: string | Uint8Array
}

export interface TestConfig<Extras extends {}> {
  name: string
  fs: Storage
  prepare?(utils: TestUtils): Promise<Extras>
  handle(utils: TestUtils & Extras): void | Promise<void>

  options?: TestOptions
}

export function defineTest<T>(config: TestConfig<T>) {
  return test(config.name, config.options ?? {}, async ({ expect }) => {
    let utils = await setup(config)
    let extras = await config.prepare?.(utils)

    await config.handle({
      ...utils,
      ...extras,
    })
  })
}

async function setup<T>(config: TestConfig<T>): Promise<TestUtils> {
  let randomId = Math.random().toString(36).substring(7)

  let baseDir = path.resolve(process.cwd(), `../../.debug/${randomId}`)
  let doneDir = path.resolve(process.cwd(), `../../.debug/${randomId}-done`)

  await fs.mkdir(baseDir, { recursive: true })

  await prepareFileSystem(baseDir, config.fs)
  await installDependencies(baseDir, config.fs)

  onTestFinished(async (result) => {
    // Once done, move all the files to a new location
    await fs.rename(baseDir, doneDir)

    if (result.state === 'fail') return

    if (path.sep === '\\') return

    // Remove the directory on *nix systems. Recursive removal on Windows will
    // randomly fail b/c its slow and buggy.
    await fs.rm(doneDir, { recursive: true })
  })

  return {
    root: baseDir,
  }
}

async function prepareFileSystem(base: string, storage: Storage) {
  // Create a temporary directory to store the test files
  await fs.mkdir(base, { recursive: true })

  // Write the files to disk
  for (let [filepath, content] of Object.entries(storage)) {
    let fullPath = path.resolve(base, filepath)
    await fs.mkdir(path.dirname(fullPath), { recursive: true })
    await fs.writeFile(fullPath, content, { encoding: 'utf-8' })
  }
}

async function installDependencies(base: string, storage: Storage) {
  for (let filepath of Object.keys(storage)) {
    if (!filepath.endsWith('package.json')) continue

    let pkgDir = path.dirname(filepath)
    let basePath = path.resolve(pkgDir, base)

    await installDependenciesIn(basePath)
  }
}

async function installDependenciesIn(dir: string) {
  console.log(`Installing dependencies in ${dir}`)

  await new Promise((resolve, reject) => {
    proc.exec('npm install --package-lock=false', { cwd: dir }, (err, res) => {
      if (err) {
        reject(err)
      } else {
        resolve(res)
      }
    })
  })
}

export const css = dedent
export const html = dedent
export const js = dedent
export const json = dedent
