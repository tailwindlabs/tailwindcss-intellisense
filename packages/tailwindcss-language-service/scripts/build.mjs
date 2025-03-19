import path from 'node:path'
import { spawnSync } from 'node:child_process'
import esbuild from 'esbuild'
import minimist from 'minimist'
import { nodeExternalsPlugin } from 'esbuild-node-externals'

const __dirname = new URL('.', import.meta.url).pathname

const args = minimist(process.argv.slice(2), {
  boolean: ['watch', 'minify'],
})

console.log('- Preparing')
let build = await esbuild.context({
  entryPoints: [path.resolve(__dirname, '../src/index.ts')],
  bundle: true,
  platform: 'node',
  external: [],
  outdir: 'dist',
  minify: args.minify,

  format: 'esm',

  plugins: [
    nodeExternalsPlugin(),
    {
      name: 'generate-types',
      async setup(build) {
        build.onEnd(async (result) => {
          // Call the tsc command to generate the types
          spawnSync(
            'tsc',
            ['-p', path.resolve(__dirname, './tsconfig.build.json'), '--emitDeclarationOnly', '--outDir', path.resolve(__dirname, '../dist')],
            {
              stdio: 'inherit',
            },
          )
        })
      },
    },
  ],
})

console.log('- Building')
await build.rebuild()

if (args.watch) {
  console.log('- Watching')
  await build.watch()
} else {
  console.log('- Cleaning up')
  await build.dispose()
}
