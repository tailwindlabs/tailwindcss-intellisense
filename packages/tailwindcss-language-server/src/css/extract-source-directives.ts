import type { Plugin } from 'postcss'

export function extractSourceDirectives(sources: string[]): Plugin {
  return {
    postcssPlugin: 'extract-at-rules',
    AtRule: {
      source: (node) => {
        if (node.params[0] !== '"' && node.params[0] !== "'") return
        sources.push(node.params.slice(1, -1))

        console.log(node.toString())
      },
    },
  }
}
