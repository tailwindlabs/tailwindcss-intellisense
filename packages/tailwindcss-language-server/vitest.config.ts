import { defineConfig } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  test: {
    testTimeout: 15000,
    css: true,
  },

  plugins: [tsconfigPaths()],
})
