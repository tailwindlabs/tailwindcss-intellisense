import * as rpc from 'vscode-jsonrpc/node'
import * as proc from 'node:child_process'
import * as path from 'node:path'
import * as fs from 'node:fs/promises'
import { type ScanOptions, type ScanResult } from './oxide'

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
  helper: proc.ChildProcess | null = null
  connection: rpc.MessageConnection | null = null

  public async scan(options: ScanOptions): Promise<ScanResult> {
    await this.startIfNeeded()

    return await this.connection.sendRequest('scan', options)
  }

  async startIfNeeded(): Promise<void> {
    if (this.connection) return

    // TODO: Can we find a way to not require a build first?
    // let module = path.resolve(path.dirname(__filename), './oxide-helper.ts')

    let modulePaths = [
      // Separate Language Server package
      '../bin/oxide-helper.js',

      // Bundled with the VSCode extension
      '../dist/oxide-helper.js',
    ]

    let module: string | null = null

    for (let relativePath of modulePaths) {
      let filepath = path.resolve(path.dirname(__filename), relativePath)

      if (
        await fs.access(filepath).then(
          () => true,
          () => false,
        )
      ) {
        module = filepath
        break
      }
    }

    if (!module) throw new Error('unable to load')

    let helper = proc.fork(module)
    let connection = rpc.createMessageConnection(
      new rpc.IPCMessageReader(helper),
      new rpc.IPCMessageWriter(helper),
    )

    helper.on('disconnect', () => {
      connection.dispose()
      this.connection = null
      this.helper = null
    })

    helper.on('exit', () => {
      connection.dispose()
      this.connection = null
      this.helper = null
    })

    connection.listen()

    this.helper = helper
    this.connection = connection
  }

  async stop() {
    if (!this.helper) return

    this.helper.disconnect()
    this.helper.kill()
  }
}
