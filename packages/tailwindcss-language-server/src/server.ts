import './lib/env'
import { createConnection } from 'vscode-languageserver/node'
import { formatError } from './util/error'
import preflight from 'tailwindcss/lib/css/preflight.css'
import { TW } from './tw'

// @ts-ignore
global.__preflight = preflight
new Function(
  'require',
  '__dirname',
  `
    let oldReadFileSync = require('fs').readFileSync
    require('fs').readFileSync = function (filename, ...args) {
      if (filename === require('path').join(__dirname, 'css/preflight.css')) {
        return global.__preflight
      }
      return oldReadFileSync(filename, ...args)
    }
  `
)(require, __dirname)

const connection =
  process.argv.length <= 2 ? createConnection(process.stdin, process.stdout) : createConnection()

console.log = connection.console.log.bind(connection.console)
console.error = connection.console.error.bind(connection.console)

process.on('unhandledRejection', (e: any) => {
  connection.console.error(formatError(`Unhandled exception`, e))
})

const tw = new TW(connection)

tw.setup()
tw.listen()
