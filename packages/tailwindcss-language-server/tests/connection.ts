import { fork } from 'node:child_process'
import { createConnection } from 'vscode-languageserver/node'
import type { ProtocolConnection } from 'vscode-languageclient/node'

export async function launch() {
  let child = fork('./bin/tailwindcss-language-server', { silent: true })

  let client = createConnection(child.stdout!, child.stdin!) as unknown as ProtocolConnection

  client.listen()

  return {
    client,
  }
}
