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
    // Assign the promise synchronously so parallel callers (e.g. Promise.all
    // over many CSS roots in ProjectLocator.search) share one helper process.
    // See: https://github.com/tailwindlabs/tailwindcss-intellisense/issues/1519
    // See: https://github.com/tailwindlabs/tailwindcss-intellisense/issues/1553
    this.server ??= this.start()

    return this.server
  }

  private start(): Promise<ServerHandle> {
    // 1. Start the new process
    let helper = proc.fork(helperPath)

    let serverPromise = (async (): Promise<ServerHandle> => {
      try {
        // 2. If the process fails to spawn we want to throw
        await new Promise<void>((resolve, reject) => {
          helper.once('spawn', () => resolve())
          helper.once('error', reject)
        })

        // 3. Setup a channel to talk to the server
        let connection = rpc.createMessageConnection(
          new rpc.IPCMessageReader(helper),
          new rpc.IPCMessageWriter(helper),
        )

        // 4. If the process exits we can tear down everything
        helper.once('close', () => {
          connection.dispose()
          if (this.server === serverPromise) {
            this.server = null
          }
        })

        // 5. Start listening for messages
        connection.listen()

        return { helper, connection }
      } catch (err) {
        // Fork succeeded but setup failed — don't leave an orphan helper around.
        helper.kill()
        throw err
      }
    })()

    // Clear a failed startup so a later call can retry (rebuilds, etc.)
    serverPromise.catch(() => {
      if (this.server === serverPromise) {
        this.server = null
      }
    })

    return serverPromise
  }

  async stop() {
    let serverPromise = this.server
    if (!serverPromise) return

    // Drop the cached handle immediately so concurrent startIfNeeded() calls
    // open a fresh session instead of talking to a process we're killing.
    // Without this, file-change restarts can accumulate live oxide-helpers
    // (#1553) when an old helper's `close` is delayed.
    this.server = null

    let server: ServerHandle
    try {
      server = await serverPromise
    } catch {
      return
    }

    await new Promise<void>((resolve) => {
      let settled = false
      let done = () => {
        if (settled) return
        settled = true
        resolve()
      }

      server.helper.once('close', done)
      server.helper.kill()

      // Fallback: some platforms leave the child in an uninterruptible wait.
      setTimeout(() => {
        if (!server.helper.killed) {
          server.helper.kill('SIGKILL')
        }
        done()
      }, 1000)
    })
  }
}
