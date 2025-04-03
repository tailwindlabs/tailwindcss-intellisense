import { defineConfig } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  test: {
    testTimeout: 15000,
    css: true,
    silent: 'passed-only',
  },

  plugins: [
    tsconfigPaths(),
    {
      name: 'force-inline-css',
      enforce: 'pre',
      resolveId(id) {
        if (!id.includes('index.css')) return
        if (id.includes('?raw')) return
        return this.resolve(`${id}?raw`)
      },
    },
  ],
})
