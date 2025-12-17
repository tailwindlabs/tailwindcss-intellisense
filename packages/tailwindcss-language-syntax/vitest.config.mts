import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    testTimeout: 15000,
    silent: 'passed-only',
  },

  define: {
    'process.env.TEST': '1',
  },
})
