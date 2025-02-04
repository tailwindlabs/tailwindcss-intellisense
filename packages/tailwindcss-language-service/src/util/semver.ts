import semverGte from 'semver/functions/gte.js'
import semverLte from 'semver/functions/lte.js'

export function gte(v1: string, v2: string): boolean {
  if (v1.startsWith('0.0.0-insiders')) {
    return true
  }

  return semverGte(v1, v2)
}

export function lte(v1: string, v2: string): boolean {
  if (v1.startsWith('0.0.0-insiders')) {
    return false
  }

  return semverLte(v1, v2)
}
