import * as semver from './semver'

export function docsUrl(version: string, paths: string | string[]): string {
  let major = 0
  let url = 'https://tailwindcss-v0.netlify.app/docs/'
  if (semver.gte(version, '0.99.0')) {
    major = 1
    url = 'https://v1.tailwindcss.com/docs/'
  }
  if (semver.gte(version, '1.99.0')) {
    major = 2
    url = 'https://v2.tailwindcss.com/docs/'
  }
  if (semver.gte(version, '2.99.0')) {
    major = 3
    url = 'https://v3.tailwindcss.com/docs/'
  }
  if (semver.gte(version, '3.99.0')) {
    major = 4
    url = 'https://tailwindcss.com/docs/'
  }
  const path = Array.isArray(paths) ? paths[major] || paths[paths.length - 1] : paths
  return `${url}${path}`
}
