import { Connection } from 'vscode-languageserver'

export function onMessage(
  connection: Connection,
  name: string,
  handler: (params: any) => any
): void {
  connection.onNotification(`tailwindcss/${name}`, async (params: any) => {
    const { _id, ...rest } = params
    connection.sendNotification(`tailwindcss/${name}Response`, {
      _id,
      ...(await handler(rest)),
    })
  })
}
