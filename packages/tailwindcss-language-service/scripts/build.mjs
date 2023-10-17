import esbuild from 'esbuild'
import path from 'node:path'

const __dirname = new URL('.', import.meta.url).pathname

console.log('- Preparing')
let builds = await Promise.all([
  esbuild.context({
    entryPoints: [path.resolve(__dirname, '../src/index.ts')],
    bundle: true,
    platform: 'node',
    external: [],
    outdir: 'dist',
    minify: process.argv.includes('--minify'),

    format: 'cjs',
  }),

  esbuild.context({
    entryPoints: [path.resolve(__dirname, '../src/index.ts')],
    bundle: true,
    platform: 'node',
    external: [],
    outdir: 'dist',
    minify: process.argv.includes('--minify'),

    format: 'esm',
  }),
])

console.log('- Building')
await Promise.all(builds.map((build) => build.rebuild()))

if (process.argv.includes('--watch')) {
  console.log('- Watching')
  await Promise.all(builds.map((build) => build.watch()))
} else {
  console.log('- Cleaning up')
  await Promise.all(builds.map((build) => build.dispose()))
}
