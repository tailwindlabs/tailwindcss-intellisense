import * as path from 'path'
import type {
  ExtensionContext,
  TextDocument,
  CompletionList,
  ProviderResult,
  OutputChannel,
} from 'vscode'
import {
  workspace as Workspace,
  languages as Languages,
  Uri,
  Position,
  Range,
  CompletionItem,
  CompletionItemKind,
  SnippetString,
  TextEdit,
} from 'vscode'
import type { Disposable, LanguageClientOptions, ServerOptions } from 'vscode-languageclient/node'
import { LanguageClient, TransportKind } from 'vscode-languageclient/node'

let booted = false

/**
 * Start the CSS language server
 * We have a customized version of the CSS language server that supports Tailwind CSS completions
 * It operates in the Tailwind CSS language mode only
 */
export async function boot(context: ExtensionContext, outputChannel: OutputChannel) {
  if (booted) return
  booted = true

  let module = context.asAbsolutePath(path.join('dist', 'cssServer.js'))
  let prod = path.join('dist', 'tailwindModeServer.js')

  try {
    await Workspace.fs.stat(Uri.joinPath(context.extensionUri, prod))
    module = context.asAbsolutePath(prod)
  } catch (_) {}

  let serverOptions: ServerOptions = {
    run: {
      module,
      transport: TransportKind.ipc,
    },
    debug: {
      module,
      transport: TransportKind.ipc,
      options: {
        execArgv: ['--nolazy', '--inspect=6051'],
      },
    },
  }

  let clientOptions: LanguageClientOptions = {
    documentSelector: [{ language: 'tailwindcss' }],
    outputChannelName: 'Tailwind CSS Language Mode',
    synchronize: { configurationSection: ['css'] },
    middleware: {
      provideCompletionItem(document, position, context, token, next) {
        function updateRanges(item: CompletionItem) {
          const range = item.range
          if (
            range instanceof Range &&
            range.end.isAfter(position) &&
            range.start.isBeforeOrEqual(position)
          ) {
            item.range = { inserting: new Range(range.start, position), replacing: range }
          }
        }

        function updateLabel(item: CompletionItem) {
          if (item.kind === CompletionItemKind.Color) {
            item.label = {
              label: item.label as string,
              description: item.documentation as string,
            }
          }
        }

        function updateProposals(
          r: CompletionItem[] | CompletionList | null | undefined,
        ): CompletionItem[] | CompletionList | null | undefined {
          if (r) {
            ;(Array.isArray(r) ? r : r.items).forEach(updateRanges)
            ;(Array.isArray(r) ? r : r.items).forEach(updateLabel)
          }
          return r
        }

        const isThenable = <T>(obj: ProviderResult<T>): obj is Thenable<T> =>
          obj && (<any>obj)['then']

        const r = next(document, position, context, token)

        if (isThenable<CompletionItem[] | CompletionList | null | undefined>(r)) {
          return r.then(updateProposals)
        }

        return updateProposals(r)
      },
    },
  }

  outputChannel.appendLine(`Booting CSS server for Tailwind CSS language mode`)

  let client = new LanguageClient(
    'tailwindcss-intellisense-css',
    'Tailwind CSS',
    serverOptions,
    clientOptions,
  )

  await client.start()

  context.subscriptions.push(initCompletionProvider())

  function initCompletionProvider(): Disposable {
    const regionCompletionRegExpr = /^(\s*)(\/(\*\s*(#\w*)?)?)?$/

    return Languages.registerCompletionItemProvider(['tailwindcss'], {
      provideCompletionItems(doc: TextDocument, pos: Position) {
        let lineUntilPos = doc.getText(new Range(new Position(pos.line, 0), pos))
        let match = lineUntilPos.match(regionCompletionRegExpr)
        if (!match) {
          return null
        }

        let range = new Range(new Position(pos.line, match[1].length), pos)

        let beginProposal = new CompletionItem('#region', CompletionItemKind.Snippet)
        beginProposal.range = range
        TextEdit.replace(range, '/* #region */')
        beginProposal.insertText = new SnippetString('/* #region $1*/')
        beginProposal.documentation = 'Folding Region Start'
        beginProposal.filterText = match[2]
        beginProposal.sortText = 'za'

        let endProposal = new CompletionItem('#endregion', CompletionItemKind.Snippet)
        endProposal.range = range
        endProposal.insertText = '/* #endregion */'
        endProposal.documentation = 'Folding Region End'
        endProposal.sortText = 'zb'
        endProposal.filterText = match[2]

        return [beginProposal, endProposal]
      },
    })
  }
}
