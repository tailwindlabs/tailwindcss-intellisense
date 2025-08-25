#!/usr/bin/env node
import './lib/env'
import { createConnection } from 'vscode-languageserver/node'
// @ts-ignore
import preflight from 'tailwindcss/lib/css/preflight.css'
import { TW } from './tw'
import { interceptLogs } from './util/logs'

// @ts-ignore
// new Function(…) is used to work around issues with esbuild
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
  `,
)(require, __dirname)

const connection =
  process.argv.length <= 2 ? createConnection(process.stdin, process.stdout) : createConnection()

interceptLogs(console, connection)

process.on('unhandledRejection', (e: any) => {
  console.error(`Unhandled rejection`, e)
})

const tw = new TW(connection)

console.log('Setting up server…')
tw.setup()

console.log('Listening for messages…')
tw.listen()
