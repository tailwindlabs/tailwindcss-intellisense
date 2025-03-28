import { workspace, CancellationTokenSource, OutputChannel, ExtensionContext, Uri } from 'vscode'
import { anyWorkspaceFoldersNeedServer, fileMayBeTailwindRelated } from './analyze'

interface ApiOptions {
  context: ExtensionContext
  outputChannel: OutputChannel
}

export async function createApi({ context, outputChannel }: ApiOptions) {
  let folderAnalysis: Promise<boolean> | null = null

  async function workspaceNeedsLanguageServer() {
    if (folderAnalysis) return folderAnalysis

    let source: CancellationTokenSource | null = new CancellationTokenSource()
    source.token.onCancellationRequested(() => {
      source?.dispose()
      source = null

      outputChannel.appendLine(
        'Server was not started. Search for Tailwind CSS-related files was taking too long.',
      )
    })

    // Cancel the search after roughly 15 seconds
    setTimeout(() => source?.cancel(), 15_000)
    context.subscriptions.push(source)

    folderAnalysis ??= anyWorkspaceFoldersNeedServer({
      token: source.token,
      folders: workspace.workspaceFolders ?? [],
    })

    let result = await folderAnalysis
    source?.dispose()
    return result
  }

  async function stylesheetNeedsLanguageServer(uri: Uri) {
    outputChannel.appendLine(`Checking if ${uri.fsPath} may be Tailwind-related…`)

    return fileMayBeTailwindRelated(uri)
  }

  return {
    workspaceNeedsLanguageServer,
    stylesheetNeedsLanguageServer,
  }
}
