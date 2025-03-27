import { lte } from '@tailwindcss/language-service/src/util/semver'

// This covers the Oxide API from v4.0.0-alpha.1 to v4.0.0-alpha.18
declare namespace OxideV1 {
  interface GlobEntry {
    base: string
    glob: string
  }

  interface ScanOptions {
    base: string
    globs?: boolean
  }

  interface ScanResult {
    files: Array<string>
    globs: Array<GlobEntry>
  }
}

// This covers the Oxide API from v4.0.0-alpha.19
declare namespace OxideV2 {
  interface GlobEntry {
    base: string
    pattern: string
  }

  interface ScanOptions {
    base: string
    sources: Array<GlobEntry>
  }

  interface ScanResult {
    files: Array<string>
    globs: Array<GlobEntry>
  }
}

// This covers the Oxide API from v4.0.0-alpha.30+
declare namespace OxideV3And4 {
  interface GlobEntry {
    base: string
    pattern: string
  }

  interface ScannerOptions {
    detectSources?: { base: string }
    sources: Array<GlobEntry>
  }

  interface ScannerConstructor {
    new (options: ScannerOptions): Scanner
  }

  interface Scanner {
    files: Array<string>
    globs: Array<GlobEntry>
  }
}

// This covers the Oxide API from v4.1.0+
declare namespace OxideV5 {
  interface GlobEntry {
    base: string
    pattern: string
  }

  interface SourceEntry {
    base: string
    pattern: string
    negated: boolean
  }

  interface ScannerOptions {
    sources: Array<SourceEntry>
  }

  interface ScannerConstructor {
    new (options: ScannerOptions): Scanner
  }

  interface Scanner {
    get files(): Array<string>
    get globs(): Array<GlobEntry>
  }
}

interface Oxide {
  scanDir?(options: OxideV1.ScanOptions): OxideV1.ScanResult
  scanDir?(options: OxideV2.ScanOptions): OxideV2.ScanResult
  Scanner?: OxideV3And4.ScannerConstructor | OxideV5.ScannerConstructor
}

async function loadOxideAtPath(id: string): Promise<Oxide | null> {
  let oxide = await import(id)

  // This is a much older, unsupported version of Oxide before v4.0.0-alpha.1
  if (!oxide.scanDir && !oxide.Scanner) return null

  return oxide
}

interface GlobEntry {
  base: string
  pattern: string
}

interface SourceEntry {
  base: string
  pattern: string
  negated: boolean
}

interface ScanOptions {
  oxidePath: string
  oxideVersion: string
  basePath: string
  sources: Array<SourceEntry>
}

interface ScanResult {
  files: Array<string>
  globs: Array<GlobEntry>
}

/**
 * This is a helper function that leverages the Oxide API to scan a directory
 * and a set of sources and turn them into files and globs.
 *
 * Because the Oxide API has changed over time this function presents a unified
 * interface that works with all versions of the Oxide API but the results may
 * be different depending on the version of Oxide that is being used.
 *
 * For example, the `sources` option is ignored before v4.0.0-alpha.19.
 */
export async function scan(options: ScanOptions): Promise<ScanResult | null> {
  let oxide = await loadOxideAtPath(options.oxidePath)
  if (!oxide) return null

  // V1
  if (lte(options.oxideVersion, '4.0.0-alpha.18')) {
    let result = oxide.scanDir?.({
      base: options.basePath,
      globs: true,
    })

    return {
      files: result.files,
      globs: result.globs.map((g) => ({ base: g.base, pattern: g.glob })),
    }
  }

  // V2
  else if (lte(options.oxideVersion, '4.0.0-alpha.19')) {
    let result = oxide.scanDir({
      base: options.basePath,
      sources: options.sources.map((g) => ({ base: g.base, pattern: g.pattern })),
    })

    return {
      files: result.files,
      globs: result.globs.map((g) => ({ base: g.base, pattern: g.pattern })),
    }
  }

  // V3
  else if (lte(options.oxideVersion, '4.0.0-alpha.30')) {
    let scanner = new (oxide.Scanner as OxideV3And4.ScannerConstructor)({
      detectSources: { base: options.basePath },
      sources: options.sources.map((g) => ({ base: g.base, pattern: g.pattern })),
    })

    return {
      files: scanner.files,
      globs: scanner.globs.map((g) => ({ base: g.base, pattern: g.pattern })),
    }
  }

  // V4
  else if (lte(options.oxideVersion, '4.0.9999')) {
    let scanner = new (oxide.Scanner as OxideV3And4.ScannerConstructor)({
      sources: [
        { base: options.basePath, pattern: '**/*' },
        ...options.sources.map((g) => ({ base: g.base, pattern: g.pattern })),
      ],
    })

    return {
      files: scanner.files,
      globs: scanner.globs.map((g) => ({ base: g.base, pattern: g.pattern })),
    }
  }

  // V5
  else {
    let scanner = new (oxide.Scanner as OxideV5.ScannerConstructor)({
      sources: [
        { base: options.basePath, pattern: '**/*', negated: false },
        ...options.sources.map((g) => ({ base: g.base, pattern: g.pattern, negated: g.negated })),
      ],
    })

    return {
      files: scanner.files,
      globs: scanner.globs.map((g) => ({ base: g.base, pattern: g.pattern })),
    }
  }
}
