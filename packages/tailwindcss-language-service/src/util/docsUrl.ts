import semver from 'semver'

export function docsUrl(version: string, paths: string | string[]): string {
  let major = 0
  let url = 'https://v0.tailwindcss.com/docs/'
  if (semver.gte(version, '0.99.0')) {
    major = 1
    url = 'https://tailwindcss.com/docs/'
  }
  const path = Array.isArray(paths)
    ? paths[major] || paths[paths.length - 1]
    : paths
  return `${url}${path}`
}
