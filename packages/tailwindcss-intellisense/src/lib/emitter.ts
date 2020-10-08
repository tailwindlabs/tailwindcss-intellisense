import mitt from 'mitt'
import { LanguageClient } from 'vscode-languageclient'
import crypto from 'crypto'
import { Connection } from 'vscode-languageserver'

export interface NotificationEmitter {
  on: (name: string, handler: (args: any) => void) => void
  off: (name: string, handler: (args: any) => void) => void
  emit: (name: string, args: any) => Promise<any>
}

export function createEmitter(
  client: LanguageClient | Connection
): NotificationEmitter {
  const emitter = mitt()
  const registered: string[] = []

  const on = (name: string, handler: (args: any) => void) => {
    if (!registered.includes(name)) {
      registered.push(name)
      client.onNotification(`tailwindcss/${name}`, (args) =>
        emitter.emit(name, args)
      )
    }
    emitter.on(name, handler)
  }

  const off = (name: string, handler: (args: any) => void) => {
    emitter.off(name, handler)
  }

  const emit = (name: string, params: Record<string, any> = {}) => {
    return new Promise((resolve, _reject) => {
      const id = crypto.randomBytes(16).toString('hex')
      on(`${name}Response`, (result) => {
        const { _id, ...rest } = result
        if (_id === id) {
          resolve(rest)
        }
      })
      client.sendNotification(`tailwindcss/${name}`, {
        _id: id,
        ...params,
      })
    })
  }

  return {
    on,
    off,
    emit,
  }
}
