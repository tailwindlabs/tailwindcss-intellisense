import { State } from './state'
import * as childProcess from 'child_process'
import { Range } from 'vscode-languageserver'

let fork: childProcess.ChildProcess

export default function getConfigLocation(
  state: State,
  key: string[]
): Promise<ConfigLocation> {
  if (!fork) {
    fork = childProcess.fork(__filename, ['--definition'])
  }

  return new Promise((resolve, reject) => {
    function callback(msg: ConfigLocation) {
      if (JSON.stringify(msg.key) !== JSON.stringify(key)) return
      fork.off('message', callback)
      if (msg.file) {
        resolve(msg)
      } else {
        reject()
      }
    }

    fork.on('message', callback)
    fork.send([state.configPath, key])
  })
}

export type ConfigLocation = {
  key: string[]
  file: string
  range: Range
}
