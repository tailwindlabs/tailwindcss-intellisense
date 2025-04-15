import type { TextDocument } from 'vscode-languageserver-textdocument'
import type { ServiceOptions } from '../service'
import { createVirtualDocument, type Document } from './document'

export function createDocumentStore(opts: ServiceOptions) {
  let documents = new Map<string, [version: number, doc: Document]>()

  return {
    clear: () => documents.clear(),

    async parse(uri: string | TextDocument) {
      let textDoc = typeof uri === 'string' ? await opts.fs.document(uri) : uri

      // Return from the cache if the document has not changed
      let found = documents.get(textDoc.uri)
      if (found && found[0] === textDoc.version) return found[1]

      let doc = await createVirtualDocument(opts, textDoc)

      documents.set(textDoc.uri, [textDoc.version, doc])

      return doc
    },
  }
}
