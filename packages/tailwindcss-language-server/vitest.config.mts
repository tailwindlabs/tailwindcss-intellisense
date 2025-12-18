import { defineConfig } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  test: {
    testTimeout: 15000,
    css: true,
    silent: 'passed-only',
  },

  define: {
    'process.env.TEST': '1',
  },

  plugins: [
    tsconfigPaths(),
    {
      name: 'force-inline-css',
      enforce: 'pre',
      resolveId(id) {
        if (id.includes('?raw')) return

        if (
          id.includes('index.css') ||
          id.includes('theme.css') ||
          id.includes('utilities.css') ||
          id.includes('preflight.css')
        ) {
          return this.resolve(`${id}?raw`)
        }
      },
    },
  ],
})
