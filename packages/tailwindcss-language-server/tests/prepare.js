const glob = require('fast-glob')
const path = require('path')
const childProcess = require('child_process')

const fixtures = glob.sync('tests/fixtures/*/package.json')

for (let fixture of fixtures) {
  childProcess.execSync('npm install', { cwd: path.dirname(fixture) })
}
