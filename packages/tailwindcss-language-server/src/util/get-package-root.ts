import findUp from 'find-up'
import * as path from 'node:path'

export async function getPackageRoot(cwd: string, rootDir: string) {
  async function check(dir: string) {
    let pkgJson = path.join(dir, 'package.json')
    if (await findUp.exists(pkgJson)) {
      return pkgJson
    }

    if (dir === path.normalize(rootDir)) {
      return findUp.stop
    }
  }

  try {
    let pkgJsonPath = await findUp(check, { cwd })
    return pkgJsonPath ? path.dirname(pkgJsonPath) : rootDir
  } catch {
    return rootDir
  }
}
