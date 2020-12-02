import { window, Uri, Range, Position } from 'vscode'
import { NotificationEmitter } from './emitter'

export function registerConfigErrorHandler(emitter: NotificationEmitter) {
  emitter.on('configError', async ({ message, file, line }) => {
    const actions: string[] = file ? ['View'] : []
    const action = await window.showErrorMessage(
      `Tailwind CSS: ${message}`,
      ...actions
    )
    if (action === 'View') {
      window.showTextDocument(Uri.file(file), {
        selection: new Range(
          new Position(line - 1, 0),
          new Position(line - 1, 0)
        ),
      })
    }
  })
}
