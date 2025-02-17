#!/usr/bin/env node
import { createConnection, ProposedFeatures } from 'vscode-languageserver/node'
import { interceptLogs } from '../util/logs'
import { CssServer } from './css-server'

let connection =
  process.argv.length <= 2
    ? createConnection(ProposedFeatures.all, process.stdin, process.stdout)
    : createConnection(ProposedFeatures.all)

interceptLogs(console, connection)

process.on('unhandledRejection', (e: any) => {
  console.error('Unhandled exception', e)
})

let server = new CssServer(connection)
server.setup()
server.listen()
