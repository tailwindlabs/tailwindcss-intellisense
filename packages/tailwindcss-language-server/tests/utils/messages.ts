import { Feature } from '@tailwindcss/language-service/src/features'
import { MessageDirection, ProtocolNotificationType } from 'vscode-languageserver'
import type { DocumentUri } from 'vscode-languageserver-textdocument'

export interface DocumentReady {
  uri: DocumentUri
}

export namespace DocumentReadyNotification {
  export const method: '@/tailwindCSS/documentReady' = '@/tailwindCSS/documentReady'
  export const messageDirection: MessageDirection = MessageDirection.clientToServer
  export const type = new ProtocolNotificationType<DocumentReady, {}>(method)
}

export interface ProjectDetails {
  uri: string
  config: string
  tailwind: {
    version: string
    features: Feature[]
    isDefaultVersion: boolean
  }
}

export namespace ProjectDetailsNotification {
  export const method: '@/tailwindCSS/projectDetails' = '@/tailwindCSS/projectDetails'
  export const messageDirection: MessageDirection = MessageDirection.clientToServer
  export const type = new ProtocolNotificationType<ProjectDetails, {}>(method)
}
