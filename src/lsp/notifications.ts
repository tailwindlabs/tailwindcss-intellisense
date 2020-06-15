import { Connection } from 'vscode-languageserver'
import { LanguageClient } from 'vscode-languageclient'

export function onMessage(
  connection: LanguageClient | Connection,
  name: string,
  handler: (params: any) => Thenable<Record<string, any>>
): void {
  connection.onNotification(`tailwindcss/${name}`, async (params: any) => {
    const { _id, ...rest } = params
    connection.sendNotification(`tailwindcss/${name}Response`, {
      _id,
      ...(await handler(rest)),
    })
  })
}
