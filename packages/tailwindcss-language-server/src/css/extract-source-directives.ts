import type { Plugin } from 'postcss'

export function extractSourceDirectives(sources: string[]): Plugin {
  return {
    postcssPlugin: 'extract-at-rules',
    AtRule: {
      source: ({ params }) => {
        if (params[0] !== '"' && params[0] !== "'") return
        sources.push(params.slice(1, -1))
      },
    },
  }
}
