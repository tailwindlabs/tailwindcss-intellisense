import type { Connection } from 'vscode-languageserver/node'

function toString(err: any, includeStack: boolean = true): string {
  if (err instanceof Error) {
    let error = <Error>err
    return `${error.message}${includeStack ? `\n${error.stack}` : ''}`
  } else if (typeof err === 'string') {
    return err
  } else {
    return err.toString()
  }
}

// https://github.com/vscode-langservers/vscode-json-languageserver/blob/master/src/utils/runner.ts
export function formatError(message: string, err: any, includeStack: boolean = true): string {
  if (err) {
    return `${message}: ${toString(err, includeStack)}`
  }
  return message
}

export function showError(
  connection: Connection,
  err: any,
  message: string = 'Tailwind CSS',
): void {
  console.error(formatError(message, err))
  // if (!(err instanceof SilentError)) {
  //   connection.sendNotification('@/tailwindCSS/error', {
  //     message: formatError(message, err, false),
  //   })
  // }
}

export function showWarning(
  connection: Connection,
  message: string = 'Tailwind CSS',
  err: any,
): void {
  connection.sendNotification('@/tailwindCSS/warn', {
    message: formatError(message, err, false),
  })
}

export function SilentError(message: string) {
  this.name = 'SilentError'
  this.message = message
  this.stack = new Error().stack
}
SilentError.prototype = new Error()
