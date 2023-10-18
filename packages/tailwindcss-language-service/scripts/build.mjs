import esbuild from 'esbuild'
import path from 'node:path'
import minimist from 'minimist'

const __dirname = new URL('.', import.meta.url).pathname

const args = minimist(process.argv.slice(2), {
  boolean: ['watch', 'minify'],
})

console.log('- Preparing')
let builds = await Promise.all([
  esbuild.context({
    entryPoints: [path.resolve(__dirname, '../src/index.ts')],
    bundle: true,
    platform: 'node',
    external: [],
    outdir: 'dist',
    minify: args.minify,

    format: 'cjs',
  }),

  esbuild.context({
    entryPoints: [path.resolve(__dirname, '../src/index.ts')],
    bundle: true,
    platform: 'node',
    external: [],
    outdir: 'dist',
    minify: args.minify,

    format: 'esm',
  }),
])

console.log('- Building')
await Promise.all(builds.map((build) => build.rebuild()))

if (args.watch) {
  console.log('- Watching')
  await Promise.all(builds.map((build) => build.watch()))
} else {
  console.log('- Cleaning up')
  await Promise.all(builds.map((build) => build.dispose()))
}
