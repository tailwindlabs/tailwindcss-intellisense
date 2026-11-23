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

// No console output here: the helper is forked with inherited stdio, so stdout
// is the language server's own JSON-RPC stream when run over stdin/stdout.
process.on('disconnect', () => {
  process.exit(0)
})
