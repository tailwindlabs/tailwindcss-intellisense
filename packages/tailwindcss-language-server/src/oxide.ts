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
    candidates: Array<string>
  }
}

// This covers the Oxide API from v4.0.0-alpha.19+
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
    candidates: Array<string>
  }
}

interface Oxide {
  scanDir?(options: OxideV1.ScanOptions): OxideV1.ScanResult
  scanDir?(options: OxideV2.ScanOptions): OxideV2.ScanResult
}

async function loadOxideAtPath(id: string): Promise<Oxide | null> {
  let oxide = await import(id)

  // This is a much older, unsupport version of Oxide before v4.0.0-alpha.1
  if (!oxide.scanDir) return null

  return oxide
}

interface GlobEntry {
  base: string
  pattern: string
}

interface ScanOptions {
  oxidePath: string
  basePath: string
  sources: Array<GlobEntry>
}

interface ScanResult {
  files: Array<string>
  globs: Array<GlobEntry>
  candidates: Array<string>
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
  const oxide = await loadOxideAtPath(options.oxidePath)
  if (!oxide) return null

  let resultV1: OxideV1.ScanResult | null = null
  let resultV2: OxideV2.ScanResult | null = null

  try {
    resultV2 = oxide.scanDir({
      base: options.basePath,
      sources: options.sources,
    })
  } catch {
    resultV1 = oxide.scanDir({
      base: options.basePath,
      globs: true,
    })
  }

  if (resultV2) {
    return {
      files: resultV2.files,
      globs: resultV2.globs,
      candidates: resultV2.candidates,
    }
  }

  return {
    files: resultV1.files,
    globs: resultV1.globs.map((g) => ({ base: g.base, pattern: g.glob })),
    candidates: resultV1.candidates,
  }
}
