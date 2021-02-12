// https://github.com/vscode-langservers/vscode-json-languageserver/blob/master/src/utils/runner.ts
export function formatError(message: string, err: any): string {
  if (err instanceof Error) {
    let error = <Error>err
    return `${message}: ${error.message}\n${error.stack}`
  } else if (typeof err === 'string') {
    return `${message}: ${err}`
  } else if (err) {
    return `${message}: ${err.toString()}`
  }
  return message
}
