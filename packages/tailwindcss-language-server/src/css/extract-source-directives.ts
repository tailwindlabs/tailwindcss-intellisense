import type { Plugin } from 'postcss'
import type { SourcePattern } from '../project-locator'

export function extractSourceDirectives(sources: SourcePattern[]): Plugin {
  return {
    postcssPlugin: 'extract-at-rules',
    AtRule: {
      source: ({ params }) => {
        let negated = false

        if (params[0] !== '"' && params[0] !== "'") return

        sources.push({
          pattern: params.slice(1, -1),
          negated,
        })
      },
    },
  }
}
