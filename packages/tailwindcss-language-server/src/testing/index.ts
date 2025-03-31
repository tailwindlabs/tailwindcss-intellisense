import { onTestFinished, test, TestOptions } from 'vitest'
import * as os from 'node:os'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import * as proc from 'node:child_process'
import dedent from 'dedent'

export interface TestUtils {
  /** The "cwd" for this test */
  root: string
}

export interface StorageSymlink {
  [IS_A_SYMLINK]: true
  filepath: string
  type: 'file' | 'dir' | undefined
}

export interface Storage {
  /** A list of files and their content */
  [filePath: string]: string | Uint8Array | StorageSymlink
}

export interface TestConfig<Extras extends {}> {
  name: string
  fs?: Storage
  debug?: boolean
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

  if (config.fs) {
    await prepareFileSystem(baseDir, config.fs)
    await installDependencies(baseDir, config.fs)
  }

  onTestFinished(async (ctx) => {
    // Once done, move all the files to a new location
    try {
      await fs.rename(baseDir, doneDir)
    } catch {
      // If it fails it doesn't really matter. It only fails on Windows and then
      // only randomly so whatever
      console.error('Failed to move test files to done directory')
    }

    if (ctx.task.result?.state === 'fail') return

    if (path.sep === '\\') return

    if (config.debug) return

    // Remove the directory on *nix systems. Recursive removal on Windows will
    // randomly fail b/c its slow and buggy.
    await fs.rm(doneDir, { recursive: true })
  })

  return {
    root: baseDir,
  }
}

const IS_A_SYMLINK = Symbol('is-a-symlink')
export function symlinkTo(filepath: string, type?: 'file' | 'dir'): StorageSymlink {
  return {
    [IS_A_SYMLINK]: true as const,
    filepath,
    type,
  }
}

async function prepareFileSystem(base: string, storage: Storage) {
  // Create a temporary directory to store the test files
  await fs.mkdir(base, { recursive: true })

  // Write the files to disk
  for (let [filepath, content] of Object.entries(storage)) {
    let fullPath = path.resolve(base, filepath)
    await fs.mkdir(path.dirname(fullPath), { recursive: true })

    if (typeof content === 'object' && IS_A_SYMLINK in content) {
      let target = path.resolve(base, content.filepath)

      let type: string = content.type

      if (os.platform() === 'win32' && content.type === 'dir') {
        type = 'junction'
      }

      await fs.symlink(target, fullPath, type)
      continue
    }

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
export const scss = dedent
export const html = dedent
export const js = dedent
export const json = dedent
