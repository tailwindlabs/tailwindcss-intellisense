import * as vscode from 'vscode'
import { ScopeTree } from '@tailwindcss/language-service/src/scopes/tree'
import type { AnyScope } from '@tailwindcss/language-service/src/scopes/scope'
import { LanguageClient } from 'vscode-languageclient/node'

interface ScopeOptions {
  tree: ScopeTree
  cursor: number
}

interface AnySource {
  name: string
  span: [number, number] | null | undefined
}

type TreeData = AnyScope | AnySource

class ScopeProvider implements vscode.TreeDataProvider<TreeData> {
  private tree: ScopeTree
  private cursor: number

  constructor() {
    this.tree = new ScopeTree([])
  }

  getParent(element: TreeData): vscode.ProviderResult<TreeData> {
    if ('name' in element) {
      if (!element.span) return null

      let path = this.tree.at(element.span[0])
      let parent = path.at(-1)
      if (!parent) return null

      return parent
    }

    let path = this.tree.pathTo(element)
    let index = path.indexOf(element)
    if (index === -1) return null

    let parent = path[index - 1]
    if (!parent) return null

    return parent
  }

  getTreeItem(scope: TreeData): vscode.TreeItem {
    if ('name' in scope) {
      return new SourceItem(scope)
    }

    let isOpen = scope.source.scope[0] <= this.cursor && this.cursor <= scope.source.scope[1]

    let state =
      scope.children.length > 0
        ? isOpen
          ? vscode.TreeItemCollapsibleState.Expanded
          : vscode.TreeItemCollapsibleState.Collapsed
        : vscode.TreeItemCollapsibleState.None

    return new ScopeItem(scope, state)
  }

  async getChildren(element?: TreeData): Promise<TreeData[]> {
    if (!element) {
      return this.tree.all()
    }

    if ('name' in element) return []

    let children: TreeData[] = []

    for (let [name, span] of Object.entries(element.source)) {
      if (name === 'scope') continue
      children.push({ name, span })
    }

    children.push(...element.children)

    return children
  }

  update(options: Partial<ScopeOptions>) {
    this.tree = options.tree ?? this.tree
    this.cursor = options.cursor ?? this.cursor
    this._onDidChangeTreeData.fire()
  }

  private _onDidChangeTreeData: vscode.EventEmitter<AnyScope | undefined | null | void> =
    new vscode.EventEmitter<AnyScope | undefined | null | void>()
  readonly onDidChangeTreeData: vscode.Event<AnyScope | undefined | null | void> =
    this._onDidChangeTreeData.event
}

class ScopeItem extends vscode.TreeItem {
  constructor(scope: AnyScope, state: vscode.TreeItemCollapsibleState) {
    let label: vscode.TreeItemLabel = {
      label: `${scope.kind} [${scope.source.scope[0]}-${scope.source.scope[1]}]`,
    }

    super(label, state)
    this.iconPath = new vscode.ThemeIcon('code')
    this.tooltip = new vscode.MarkdownString(
      `\`\`\`json\n${JSON.stringify({ ...scope, children: undefined }, null, 2)}\n\`\`\``,
    )
  }
}

class SourceItem extends vscode.TreeItem {
  constructor(source: AnySource) {
    let label: vscode.TreeItemLabel = {
      label: `- ${source.name}: `,
    }

    if (source.span) {
      label.label += `[${source.span[0]}-${source.span[1]}]`
    } else {
      label.label += '(none)'
    }

    super(label, vscode.TreeItemCollapsibleState.None)
    this.iconPath = new vscode.ThemeIcon('code')
  }
}

interface ScopeProviderOptions {
  readonly client: Promise<LanguageClient> | null
}

export function registerScopeProvider(opts: ScopeProviderOptions): vscode.Disposable {
  let trees: Map<string, ScopeTree> = new Map()
  let emptyTree = new ScopeTree([])
  let scopeProvider = new ScopeProvider()
  let disposables: vscode.Disposable[] = []

  let treeView = vscode.window.createTreeView('scopes', {
    treeDataProvider: scopeProvider,
  })

  disposables.push(treeView)

  vscode.workspace.onDidChangeTextDocument(
    async (event) => {
      if (event.document !== vscode.window.activeTextEditor.document) return
      if (!opts.client) return

      let client = await opts.client

      interface ScopesGetResponse {
        scopes: AnyScope[]
      }

      let response = await client.sendRequest<ScopesGetResponse>('@/tailwindCSS/scopes/get', {
        uri: event.document.uri.toString(),
      })

      let tree = new ScopeTree(response.scopes)
      trees.set(event.document.uri.toString(), tree)

      await refresh()
    },
    null,
    disposables,
  )

  vscode.window.onDidChangeActiveTextEditor(
    async () => {
      await refresh()
    },
    null,
    disposables,
  )

  vscode.window.onDidChangeTextEditorSelection(
    async (event) => {
      if (event.textEditor !== vscode.window.activeTextEditor) return

      let editor = event.textEditor
      let cursor = editor.document.offsetAt(editor.selection.active)
      let tree = trees.get(editor.document.uri.toString()) ?? emptyTree
      let scope = tree.at(cursor).at(-1)

      if (scope) {
        treeView.reveal(scope, {
          // select: false,
          // focus: true,
          expand: true,
        })
      }
    },
    null,
    disposables,
  )

  async function refresh() {
    if (!opts.client) return

    let editor = vscode.window.activeTextEditor
    let cursor = editor.document.offsetAt(editor.selection.active)

    scopeProvider.update({
      tree: trees.get(editor.document.uri.toString()) ?? emptyTree,
      cursor,
    })
  }

  let decoration = vscode.window.createTextEditorDecorationType({
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
  })

  disposables.push(decoration)

  function decorationForScope(scope: AnyScope) {
    let depth = 0
    for (let tree of trees.values()) {
      let path = tree.pathTo(scope)
      if (path.length > 0) {
        depth = path.length
        break
      }
    }

    return decoration
  }

  return new vscode.Disposable(() => {
    disposables.forEach((disposable) => disposable.dispose())
  })
}
