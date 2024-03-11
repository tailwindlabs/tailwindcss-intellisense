import { writeFileSync } from 'fs'
import checker from 'license-checker'
import { readFileSync } from 'fs'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'

const exclude = [/^@types\//, 'esbuild', 'rimraf', 'prettier', 'typescript', 'license-checker']

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

function getDeps(dir, dev = false) {
  return Object.entries(
    JSON.parse(readFileSync(resolve(dir, 'package.json'), 'utf-8'))[
      dev ? 'devDependencies' : 'dependencies'
    ],
  ).map(([name, version]) => `${name}@${version}`)
}

function getLicenses(dir) {
  return new Promise((resolve, reject) => {
    checker.init({ start: dir }, (err, packages) => {
      if (err) {
        reject(err)
      } else {
        resolve(packages)
      }
    })
  })
}

;(async function () {
  const __dirname = dirname(fileURLToPath(import.meta.url))
  let contents = []

  let serverDeps = getDeps(resolve(__dirname, '..'), true)
  let serviceDeps = getDeps(resolve(__dirname, '../../tailwindcss-language-service'))
  let allDeps = [...serverDeps, ...serviceDeps]

  let serverLicenses = await getLicenses(resolve(__dirname, '../'))
  let serviceLicenses = await getLicenses(resolve(__dirname, '../../tailwindcss-language-service'))
  let allLicenses = { ...serverLicenses, ...serviceLicenses }

  for (let pkg in allLicenses) {
    let parts = pkg.split('@')
    let name = parts.slice(0, parts.length - 1).join('@')
    if (allDeps.includes(pkg) && !isExcluded(name)) {
      let license = allLicenses[pkg].licenseFile
        ? readFileSync(allLicenses[pkg].licenseFile, 'utf-8').trim()
        : undefined
      if (license) {
        contents.push(`${pkg}\n\n${license}`)
      }
    }
  }

  writeFileSync(
    resolve(__dirname, '../ThirdPartyNotices.txt'),
    contents.join(`\n\n${'='.repeat(80)}\n\n`),
    'utf-8',
  )
})()
