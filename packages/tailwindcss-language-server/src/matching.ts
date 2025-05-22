import picomatch from 'picomatch'
import { DefaultMap } from './util/default-map'

export interface PathMatcher {
  anyMatches(pattern: string, paths: string[]): boolean
  clear(): void
}

export function createPathMatcher(): PathMatcher {
  let matchers = new DefaultMap<string, picomatch.Matcher>((pattern) => {
    // Escape picomatch special characters so they're matched literally
    pattern = pattern.replace(/[\[\]{}()]/g, (m) => `\\${m}`)

    return picomatch(pattern, { dot: true })
  })

  return {
    anyMatches: (pattern, paths) => {
      let check = matchers.get(pattern)
      return paths.some((path) => check(path))
    },
    clear: () => matchers.clear(),
  }
}
