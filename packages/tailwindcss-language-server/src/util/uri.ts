import { URI } from 'vscode-uri'

export function normalizeFileNameToFsPath(fileName: string) {
  return URI.file(fileName).fsPath
}

export function getFileFsPath(documentUri: string): string {
  return URI.parse(documentUri).fsPath
}
