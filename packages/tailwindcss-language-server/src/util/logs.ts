import type { Connection } from 'vscode-languageserver'
import { format } from 'node:util'

function formatForLogging(params: any[]): string {
  return params.map((item) => format(item)).join(' ')
}

export function interceptLogs(console: Console, connection: Connection) {
  console.debug = (...params: any[]) => connection.console.info(formatForLogging(params))
  console.error = (...params: any[]) => connection.console.error(formatForLogging(params))
  console.warn = (...params: any[]) => connection.console.warn(formatForLogging(params))
  console.info = (...params: any[]) => connection.console.info(formatForLogging(params))
  console.log = (...params: any[]) => connection.console.log(formatForLogging(params))
}
