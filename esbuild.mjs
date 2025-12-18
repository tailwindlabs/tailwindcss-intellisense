import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import esbuild from 'esbuild'
import minimist from 'minimist'
import checker from 'license-checker'

const require = createRequire(import.meta.url)
const __dirname = path.dirname(fileURLToPath(import.meta.url))

const args = minimist(process.argv.slice(2), {
  boolean: ['watch', 'minify'],
  string: ['outfile', 'outdir'],
})

console.log('- Preparing')
let ctx = await esbuild.context({
  entryPoints: args._,
  bundle: true,
  platform: 'node',
  external: ['pnpapi', 'vscode', 'lightningcss', '@tailwindcss/oxide'],
  format: 'cjs',
  define: {
    'process.env.TEST': '0',
  },
  outdir: args.outdir,
  outfile: args.outfile,
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
              export default ${JSON.stringify(await fs.readFile(args.path, 'utf8'))}
            `,
        }))
      },
    },
    {
      name: 'patch-jiti',
      setup(build) {
        // TODO: Switch to rolldown and see if we can chunk split this instead?
        build.onLoad({ filter: /jiti\/lib\/jiti\.mjs$/ }, async (args) => {
          let original = await fs.readFile(args.path, 'utf8')

          return {
            contents: original.replace(
              'createRequire(import.meta.url)("../dist/babel.cjs")',
              'require("../dist/babel.cjs")',
            ),
          }
        })
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
    {
      name: 'generate-notices',
      async setup() {
        let exclude = [
          /^@types\//,
          'esbuild',
          'rimraf',
          'prettier',
          'typescript',
          'license-checker',
        ]

        let allLicenses = {
          ...(await getLicenses(path.resolve(__dirname, 'packages/tailwindcss-language-server'))),
          ...(await getLicenses(path.resolve(__dirname, 'packages/tailwindcss-language-service'))),
        }

        let allDeps = [
          ...(await getDeps(path.resolve(__dirname, 'packages/tailwindcss-language-server'), true)),
          ...(await getDeps(path.resolve(__dirname, 'packages/tailwindcss-language-service'))),
        ]

        function isExcluded(name) {
          for (let pattern of exclude) {
            if (typeof pattern === 'string') {
              if (name === pattern) {
                return true
              }
            } else if (pattern.test(name)) {
              return true
            }
          }

          return false
        }

        async function getDeps(dir, dev = false) {
          let pkg = JSON.parse(await fs.readFile(path.resolve(dir, 'package.json'), 'utf-8'))

          let deps = Object.entries(pkg['dependencies'] ?? {})

          if (dev) deps.push(...Object.entries(pkg['devDependencies'] ?? {}))

          return deps.map(([name, version]) => `${name}@${version}`)
        }

        function getLicenses(dir) {
          return new Promise((resolve, reject) => {
            checker.init({ start: dir }, (err, packages) => {
              if (err) return reject(err)
              return resolve(packages)
            })
          })
        }

        let contents = []

        for (let pkg in allLicenses) {
          if (!allDeps.includes(pkg)) continue

          let parts = pkg.split('@')
          let name = parts.slice(0, parts.length - 1).join('@')
          if (isExcluded(name)) continue

          let license = allLicenses[pkg].licenseFile
            ? (await fs.readFile(allLicenses[pkg].licenseFile, 'utf-8')).trim()
            : undefined

          if (!license) continue

          contents.push(`${pkg}\n\n${license}`)
        }

        await fs.writeFile(
          path.resolve(__dirname, 'packages/tailwindcss-language-server/ThirdPartyNotices.txt'),
          contents.join(`\n\n${'='.repeat(80)}\n\n`),
          'utf-8',
        )
      },
    },
  ],
})

console.log('- Building')
await ctx.rebuild()

if (args.watch) {
  console.log('- Watching')
  await ctx.watch()
} else {
  console.log('- Cleaning up')
  await ctx.dispose()
}
