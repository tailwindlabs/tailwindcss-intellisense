import { fork } from 'node:child_process'
import { createConnection } from 'vscode-languageserver/node'
import type { ProtocolConnection } from 'vscode-languageclient/node'
import { Duplex, type Readable, type Writable } from 'node:stream'
import { TW } from '../../src/tw'
import { CssServer } from '../../src/language/css-server'

class TestStream extends Duplex {
  _write(chunk: string, _encoding: string, done: () => void) {
    this.emit('data', chunk)
    done()
  }

  _read(_size: number) {}
}

const SERVERS = {
  tailwindcss: {
    ServerClass: TW,
    binaryPath: './bin/tailwindcss-language-server',
  },
  css: {
    ServerClass: CssServer,
    binaryPath: './bin/css-language-server',
  },
}

export interface ConnectOptions {
  /**
   * How to connect to the LSP:
   * - `in-band` runs the server in the same process (default)
   * - `spawn` launches the binary as a separate process, connects via stdio,
   * and requires a rebuild of the server after making changes.
   */
  mode?: 'in-band' | 'spawn'

  /**
   * The server to connect to
   */
  server?: keyof typeof SERVERS
}

export function connect(opts: ConnectOptions) {
  let server = opts.server ?? 'tailwindcss'
  let mode = opts.mode ?? 'in-band'

  let details = SERVERS[server]
  if (!details) {
    throw new Error(`Unsupported connection: ${server} / ${mode}`)
  }

  if (mode === 'in-band') {
    let input = new TestStream()
    let output = new TestStream()

    let server = new details.ServerClass(createConnection(input, output))
    server.setup()
    server.listen()

    return connectStreams(output, input)
  } else if (mode === 'spawn') {
    let server = fork(details.binaryPath, { silent: true })

    return connectStreams(server.stdout!, server.stdin!)
  }

  throw new Error(`Unsupported connection: ${server} / ${mode}`)
}

function connectStreams(input: Readable, output: Writable) {
  let clientConn = createConnection(input, output) as unknown as ProtocolConnection
  clientConn.listen()
  return clientConn
}
