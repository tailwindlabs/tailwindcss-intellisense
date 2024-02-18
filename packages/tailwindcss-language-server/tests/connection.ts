import { fork } from 'node:child_process'
import { createConnection } from 'vscode-languageserver/node'
import type { ProtocolConnection } from 'vscode-languageclient/node'

import { Duplex } from 'node:stream'
import { TW } from '../src/tw'

export async function connect() {
  class TestStream extends Duplex {
    _write(chunk: string, _encoding: string, done: () => void) {
      this.emit('data', chunk)
      done()
    }

    _read(_size: number) {}
  }

  let input = new TestStream()
  let output = new TestStream()

  let server = createConnection(input, output)
  let tw = new TW(server)
  tw.setup()
  tw.listen()

  let client = createConnection(output, input) as unknown as ProtocolConnection
  client.listen()

  return {
    client,
  }
}

export async function launch() {
  let child = fork('./bin/tailwindcss-language-server', { silent: true })

  let client = createConnection(child.stdout!, child.stdin!) as unknown as ProtocolConnection

  client.listen()

  return {
    client,
  }
}
