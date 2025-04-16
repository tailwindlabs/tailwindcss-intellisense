import picomatch from 'picomatch'
import normalizePathBase from 'normalize-path'

export function createPathMatcher(base: string, patterns: string[]) {
  // Should we ignore this file?
  // TODO: Do we need to normalize windows paths?
  let matchers = patterns.map((pattern) => {
    pattern = `${base}/${pattern}`
    pattern = normalizePath(pattern)
    pattern = normalizeDriveLetter(pattern)

    return picomatch(`${base}/${pattern}`)
  })

  return (file: string) => {
    file = normalizePath(file)
    file = normalizeDriveLetter(file)

    return matchers.some((isMatch) => isMatch(file))
  }
}

const WIN_DRIVE_LETTER = /^([a-zA-Z]):/
const POSIX_DRIVE_LETTER = /^\/([a-zA-Z]):/

/**
 * Windows drive letters are case-insensitive and we may get them as either
 * lower or upper case. This function normalizes the drive letter to uppercase
 * to be consistent with the rest of the codebase.
 */
export function normalizeDriveLetter(filepath: string) {
  return filepath
    .replace(WIN_DRIVE_LETTER, (_, letter) => `${letter.toUpperCase()}:`)
    .replace(POSIX_DRIVE_LETTER, (_, letter) => `/${letter.toUpperCase()}:`)
}

export function normalizePath(originalPath: string) {
  let normalized = normalizePathBase(originalPath)

  // This is Windows network share but the normalize path had one of the leading
  // slashes stripped so we need to add it back
  if (
    originalPath.startsWith('\\\\') &&
    normalized.startsWith('/') &&
    !normalized.startsWith('//')
  ) {
    return `/${normalized}`
  }

  return normalized
}
