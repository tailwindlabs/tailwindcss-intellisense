#!/usr/bin/env node

import * as rpc from 'vscode-jsonrpc/node'
import { scan, type ScanOptions, type ScanResult } from './oxide'

let connection = rpc.createMessageConnection(
  new rpc.IPCMessageReader(process),
  new rpc.IPCMessageWriter(process),
)

let scanRequest = new rpc.RequestType<ScanOptions, ScanResult, void>('scan')
connection.onRequest<ScanOptions, ScanResult, void>(scanRequest, (options) => scan(options))
connection.listen()

console.log('Listening for messages...')

process.on('disconnect', () => {
  console.log('Shutting down...')
  process.exit(0)
})
