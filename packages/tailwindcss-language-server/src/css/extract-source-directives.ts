import type { Plugin } from 'postcss'
import type { SourcePattern } from '../project-locator'

export function extractSourceDirectives(sources: SourcePattern[]): Plugin {
  return {
    postcssPlugin: 'extract-at-rules',
    AtRule: {
      source: ({ params }) => {
        let negated = /^not\s+/.test(params)

        if (negated) params = params.slice(4).trimStart()

        if (params[0] !== '"' && params[0] !== "'") return

        sources.push({
          pattern: params.slice(1, -1),
          negated,
        })
      },
    },
  }
}
