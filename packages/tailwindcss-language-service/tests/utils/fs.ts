import { memfs } from 'memfs'
import { URI } from 'vscode-uri'
import { File, FileSystem, FileType } from '../../src/fs'
import * as path from 'node:path'
import { IDirent } from 'memfs/lib/node/types/misc'

export interface Storage {
  /** A list of files and their content */
  [filePath: string]: string | Buffer | null
}

export function createFileSystem(storage: Storage): FileSystem {
  let { fs } = memfs(storage, '/projects/root')

  return {
    document: async () => null,
    resolve: async (doc, relativePath) => {
      let documentPath = URI.parse(doc.uri).fsPath
      let baseDir = path.dirname(documentPath)
      return URI.file(path.resolve(baseDir, relativePath)).toString()
    },
    async readDirectory(document, filepath): Promise<File[]> {
      let uri = URI.parse(document.uri)

      let baseDir = path.dirname(uri.fsPath)
      filepath = path.resolve(baseDir, filepath)

      let dirents = await fs.promises.readdir(filepath, { withFileTypes: true })

      let results: File[] = []

      for (let dirent of dirents as IDirent[]) {
        // TODO:
        // let isDirectory = dirent.isDirectory()
        // let shouldRemove = await isExcluded(
        //   state,
        //   document,
        //   path.join(filepath, dirent.name.toString(), isDirectory ? '/' : ''),
        // )
        // if (shouldRemove) continue

        let type: FileType = 'unknown'

        if (dirent.isFile()) {
          type = 'file'
        } else if (dirent.isDirectory()) {
          type = 'directory'
        } else if (dirent.isSymbolicLink()) {
          type = 'symbolic-link'
        }

        results.push({
          name: dirent.name.toString(),
          type,
        })
      }

      return results
    },
  }
}
