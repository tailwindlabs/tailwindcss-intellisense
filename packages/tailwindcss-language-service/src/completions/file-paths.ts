import type { State } from '../util/state'

// @config, @plugin, @source
const PATTERN_CUSTOM_V4 = /@(?<directive>config|plugin|source)\s*(?<partial>'[^']*|"[^"]*)$/
const PATTERN_CUSTOM_V3 = /@(?<directive>config)\s*(?<partial>'[^']*|"[^"]*)$/

export type FileDirective = {
  directive: string
  partial: string
  suggest: 'script' | 'source'
}

export async function findFileDirective(state: State, text: string): Promise<FileDirective | null> {
  if (state.v4) {
    let match = text.match(PATTERN_CUSTOM_V4)

    if (!match) return null

    let directive = match.groups.directive
    let partial = match.groups.partial.slice(1) // remove leading quote

    // Most suggestions are for JS files so we'll default to that
    let suggest: FileDirective['suggest'] = 'script'

    // If we're looking at @source then it's for a template file
    if (directive === 'source') {
      suggest = 'source'
    }

    return { directive, partial, suggest }
  }

  let match = text.match(PATTERN_CUSTOM_V3)
  if (!match) return null

  let directive = match.groups.directive
  let partial = match.groups.partial.slice(1) // remove leading quote

  return { directive, partial, suggest: 'script' }
}
