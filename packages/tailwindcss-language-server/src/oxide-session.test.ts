import { afterEach, describe, expect, test } from 'vitest'
import * as proc from 'node:child_process'
import * as path from 'node:path'
import * as fs from 'node:fs/promises'
import * as rpc from 'vscode-jsonrpc/node'
import { OxideSession } from './oxide-session'

const helperPath = path.resolve(__dirname, '../bin/oxide-helper.js')

function countOxideHelpers(): number {
  try {
    let out = proc.execSync(`ps -axo pid=,command=`, { encoding: 'utf8' })
    return out
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.includes('oxide-helper.js'))
      .filter((line) => !line.includes(' rg') && !line.includes('vitest'))
      .length
  } catch {
    return 0
  }
}

/**
 * Pre-#1520 OxideSession shape: async path lookup before assigning connection.
 * Parallel startIfNeeded() callers each fork a helper (#1519 / #1553).
 */
class BuggyOxideSession {
  helper: proc.ChildProcess | null = null
  connection: rpc.MessageConnection | null = null

  async startIfNeeded(): Promise<void> {
    if (this.connection) return

    // Yield before fork — same race window as the old fs.access() loop
    await fs.access(helperPath)

    let helper = proc.fork(helperPath)
    let connection = rpc.createMessageConnection(
      new rpc.IPCMessageReader(helper),
      new rpc.IPCMessageWriter(helper),
    )

    helper.on('close', () => {
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
    this.helper.kill()
    this.helper = null
    this.connection = null
  }
}

describe('OxideSession', () => {
  let sessions: OxideSession[] = []
  let buggySessions: BuggyOxideSession[] = []

  afterEach(async () => {
    for (let session of sessions) {
      await session.stop()
    }
    for (let session of buggySessions) {
      await session.stop()
    }
    sessions = []
    buggySessions = []
    // Best-effort cleanup of any orphans left by the buggy session demo
    try {
      proc.execSync(`pkill -f "${helperPath}"`, { stdio: 'ignore' })
    } catch {
      // no matching processes
    }
    await new Promise((r) => setTimeout(r, 100))
  })

  test('documents the pre-#1520 race: parallel startIfNeeded forks many helpers', async () => {
    let before = countOxideHelpers()
    let session = new BuggyOxideSession()
    buggySessions.push(session)

    await Promise.all(Array.from({ length: 20 }, () => session.startIfNeeded()))
    await new Promise((r) => setTimeout(r, 100))

    let spawned = countOxideHelpers() - before
    // Only the last helper is tracked — stop() cannot reap the rest.
    expect(spawned).toBeGreaterThan(5)

    await session.stop()
    await new Promise((r) => setTimeout(r, 100))

    // Orphans remain after stop() — this is the #1553 accumulation mode
    expect(countOxideHelpers() - before).toBeGreaterThan(0)
  })

  test('parallel startIfNeeded() forks only one oxide-helper process', async () => {
    let before = countOxideHelpers()

    let session = new OxideSession()
    sessions.push(session)

    // Simulate ProjectLocator.search() loading many CSS roots via Promise.all.
    let handles = await Promise.all(Array.from({ length: 25 }, () => session.startIfNeeded()))

    expect(new Set(handles).size).toBe(1)
    expect(handles[0].helper.pid).toBeTypeOf('number')

    let during = countOxideHelpers()
    expect(during - before).toBe(1)

    await session.stop()
    await new Promise((r) => setTimeout(r, 150))

    expect(countOxideHelpers()).toBeLessThanOrEqual(before)
  })

  test('stop() terminates the helper even if start is still in flight', async () => {
    let before = countOxideHelpers()
    let session = new OxideSession()
    sessions.push(session)

    let starting = session.startIfNeeded()
    await session.stop()
    await starting.catch(() => {})
    await new Promise((r) => setTimeout(r, 150))

    expect(countOxideHelpers()).toBeLessThanOrEqual(before)
  })

  test('a new session can start after stop()', async () => {
    let session = new OxideSession()
    sessions.push(session)

    let first = await session.startIfNeeded()
    let firstPid = first.helper.pid

    await session.stop()
    await new Promise((r) => setTimeout(r, 100))

    let second = await session.startIfNeeded()
    expect(second.helper.pid).not.toBe(firstPid)
    expect(second.helper.pid).toBeTypeOf('number')
  })
})
