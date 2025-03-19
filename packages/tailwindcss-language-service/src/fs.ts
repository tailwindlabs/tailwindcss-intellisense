import { TextDocument } from 'vscode-languageserver-textdocument'

export interface FileSystem {
  /**
   * Get the document with the given URI
   */
  document(uri: string): Promise<TextDocument | null>

  /**
   * Resolve the path relative to the given document
   */
  resolve(document: TextDocument, relativePath: string): Promise<string | null>

  /**
   * List the files and directories in the given directory
   */
  readDirectory(document: TextDocument, path: string): Promise<File[]>
}

export type FileType = 'unknown' | 'file' | 'directory' | 'symbolic-link'

export interface File {
  name: string
  type: FileType
}
