import { memfs } from 'memfs'
import { URI, Utils as URIUtils } from 'vscode-uri'
import { FileSystem } from '../../src/fs'
import * as path from 'node:path'

export interface Storage {
  /** A list of files and their content */
  [filePath: string]: string | Buffer
}

export function createFileSystem(storage: Storage): FileSystem {
  let { fs, vol } = memfs(storage)

  return {
    document: async () => null,
    resolve: async (doc, relativePath) => {
      let documentPath = URI.parse(doc.uri).fsPath
      let baseDir = path.dirname(documentPath)
      return URI.file(path.resolve(baseDir, relativePath)).toString()
    },
    readDirectory: async () => [],
  }
}
