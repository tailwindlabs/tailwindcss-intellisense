import esbuild from 'esbuild'
import fs from 'fs'
import { createRequire } from 'module'
import mri from 'mri'

const require = createRequire(import.meta.url)

const args = mri(process.argv.slice(2), {
  boolean: ['watch', 'minify'],
  string: ['outfile', 'outdir', 'external'],
})

await esbuild.build({
  entryPoints: args._,
  bundle: true,
  platform: 'node',
  external: [].concat(args.external),
  format: 'cjs',
  outdir: args.outdir,
  outfile: args.outfile,
  watch: args.watch,
  minify: args.minify,
  plugins: [
    {
      name: 'css',
      setup(build) {
        build.onResolve({ filter: /\.css$/, namespace: 'file' }, (args) => ({
          path: require.resolve(args.path, { paths: [args.resolveDir] }),
          namespace: 'css',
        }))

        build.onLoad({ filter: /.*/, namespace: 'css' }, async (args) => ({
          contents: `
              export default ${JSON.stringify(await fs.promises.readFile(args.path, 'utf8'))}
            `,
        }))
      },
    },
    {
      // https://github.com/evanw/esbuild/issues/1051#issuecomment-806325487
      name: 'native-node-modules',
      setup(build) {
        // If a ".node" file is imported within a module in the "file" namespace, resolve
        // it to an absolute path and put it into the "node-file" virtual namespace.
        build.onResolve({ filter: /\.node$/, namespace: 'file' }, (args) => ({
          path: require.resolve(args.path, { paths: [args.resolveDir] }),
          namespace: 'node-file',
        }))

        // Files in the "node-file" virtual namespace call "require()" on the
        // path from esbuild of the ".node" file in the output directory.
        build.onLoad({ filter: /.*/, namespace: 'node-file' }, (args) => ({
          contents: `
              import path from ${JSON.stringify(args.path)}
              import { resolve } from 'path'
              module.exports = require(resolve(__dirname, path))
            `,
        }))

        // If a ".node" file is imported within a module in the "node-file" namespace, put
        // it in the "file" namespace where esbuild's default loading behavior will handle
        // it. It is already an absolute path since we resolved it to one above.
        build.onResolve({ filter: /\.node$/, namespace: 'node-file' }, (args) => ({
          path: args.path,
          namespace: 'file',
        }))

        // Tell esbuild's default loading behavior to use the "file" loader for
        // these ".node" files.
        let opts = build.initialOptions
        opts.loader = opts.loader || {}
        opts.loader['.node'] = 'file'
      },
    },
  ],
})
