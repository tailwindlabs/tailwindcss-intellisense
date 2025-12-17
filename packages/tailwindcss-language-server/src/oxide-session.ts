import * as rpc from 'vscode-jsonrpc/node'
import * as proc from 'node:child_process'
import * as path from 'node:path'
import { type ScanOptions, type ScanResult } from './oxide'

interface ServerHandle {
  helper: proc.ChildProcess
  connection: rpc.MessageConnection
}

/**
 * The path to the Oxide helper process
 *
 * TODO:
 * - Can we find a way to not require a build first — i.e. point to
 *   `oxide-helper.ts` and have things "hot reload" during tests?
 */
const helperPath = process.env.TEST
  ? // This first path is relative to the source file so running tests in Vitest
    // result in the correct path — does still point to the built files.
    path.resolve(path.dirname(__filename), '../bin/oxide-helper.js')
  : // The second path is relative to the built file. This is the same for the
    // language server *and* the extension since the file is named identically
    // in both builds.
    path.resolve(path.dirname(__filename), './oxide-helper.js')

/**
 * This helper starts a session in which we can use Oxide in *another process*
 * to communicate content scanning results.
 *
 * Thie exists for two reasons:
 * - The Oxide API has changed over time so this function presents a unified
 *   interface that works with all versions of the Oxide API. The results may
 *   vary but the structure of the results will always be identical.
 *
 * - Requiring a native node module on Windows permanently keeps an open handle
 *   to the binary for the duration of the process. This prevents unlinking the
 *   file like happens when running `npm ci`. Running an ephemeral process lets
 *   us sidestep the problem as the process will only be running as needed.
 */
export class OxideSession {
  /**
   * An object that represents the connection to the server
   *
   * This ensures that either everything is initialized or nothing is
   */
  private server: Promise<ServerHandle> | null = null

  public async scan(options: ScanOptions): Promise<ScanResult> {
    let server = await this.startIfNeeded()

    return await server.connection.sendRequest('scan', options)
  }

  startIfNeeded(): Promise<ServerHandle> {
    this.server ??= this.start()

    return this.server
  }

  private async start(): Promise<ServerHandle> {
    // 1. Start the new process
    let helper = proc.fork(helperPath)

    // 2. If the process fails to spawn we want to throw
    //
    // We do end up caching the failed promise but that should be
    // fine. It seems unlikely that, if this fails, trying again
    // would "fix" whatever problem there was and succeed.
    await new Promise((resolve, reject) => {
      helper.on('spawn', resolve)
      helper.on('error', reject)
    })

    // 3. Setup a channel to talk to the server
    let connection = rpc.createMessageConnection(
      new rpc.IPCMessageReader(helper),
      new rpc.IPCMessageWriter(helper),
    )

    // 4. If the process exits we can tear down everything
    helper.on('close', () => {
      connection.dispose()
      this.server = null
    })

    // 5. Start listening for messages
    connection.listen()

    return { helper, connection }
  }

  async stop() {
    if (!this.server) return

    let server = await this.server

    // We terminate the server because, if for some reason it gets stuck,
    // we don't want it to stick around.
    server.helper.kill()
  }
}
