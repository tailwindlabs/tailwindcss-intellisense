import * as childProcess from 'child_process'
import { Range } from 'vscode-languageserver'

let fork: childProcess.ChildProcess
let id = 0

export default function getConfigWithLocations(
  configPath: string,
  key?: string[]
): Promise<ConfigLocation> {
  if (!fork) {
    fork = childProcess.fork(__filename, ['--config-locations'])
  }

  let msgId = id++

  return new Promise((resolve, reject) => {
    function callback(msg: ConfigLocation) {
      if (msg.id !== msgId) return
      if ('error' in msg) {
        fork.off('message', callback)
        return reject(msg.error)
      }
      fork.off('message', callback)
      fork.kill()
      fork = undefined
      resolve(msg)
    }

    fork.on('message', callback)
    fork.send([msgId, configPath, key])
  })
}

export type ConfigLocation =
  | {
      id: number
      key: string[]
      file: string
      range: Range
    }
  | { id: number; error: string }
  | { id: number; config: any }
