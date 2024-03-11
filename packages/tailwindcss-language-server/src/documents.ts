import { type Connection, TextDocuments } from 'vscode-languageserver/node'
import { TextDocument } from 'vscode-languageserver-textdocument'

export class DocumentService {
  public documents: TextDocuments<TextDocument>

  constructor(conn: Connection) {
    this.documents = new TextDocuments(TextDocument)
    this.documents.listen(conn)
  }

  getDocument(uri: string) {
    return this.documents.get(uri)
  }

  getAllDocuments() {
    return this.documents.all()
  }

  get onDidChangeContent() {
    return this.documents.onDidChangeContent
  }
  get onDidClose() {
    return this.documents.onDidClose
  }
  get onDidOpen() {
    return this.documents.onDidOpen
  }
}
