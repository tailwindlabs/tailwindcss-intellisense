import {
  TreeDataProvider,
  TreeItem,
  TreeItemCollapsibleState,
  window,
  Command,
  Event,
  EventEmitter,
  commands,
  Uri,
  ExtensionContext,
  Range,
  Position,
  workspace as Workspace,
  ThemeIcon,
  TreeView,
} from 'vscode'
const dlv = require('dlv')
import * as path from 'path'
import * as fs from 'fs'
import * as util from 'util'
import * as crypto from 'crypto'
import { getColorFromValue } from '../lsp/util/color'
import isObject from '../util/isObject'
import { NotificationEmitter } from './emitter'
import { LanguageClient, State as ClientState } from 'vscode-languageclient'

const fileExists = util.promisify(fs.exists)

function configValueToString(
  value: unknown,
  asTooltip: boolean = false
): string {
  if (value === null) {
    return 'null'
  }
  if (typeof value === 'undefined') {
    return asTooltip ? '(undefined)' : ''
  }
  if (Array.isArray(value)) {
    if (asTooltip && value.length === 0) {
      return '(empty array)'
    }
    return value.join(', ')
  }
  if (asTooltip && value === '') {
    return '(empty string)'
  }
  return value.toString()
}

type ConfigItemParams = {
  label: string
  key?: string[]
  workspace?: string
  location?: {
    file: string
    range: Range
  }
  collapsibleState: TreeItemCollapsibleState
  description?: string
  iconPath?: string | ThemeIcon
  command?: Command
  contextValue?: string
  tooltip?: string
}

class ConfigItem extends TreeItem {
  public key: string[]
  public location?: {
    file: string
    range: Range
  }
  public workspace?: string

  constructor({
    label,
    collapsibleState,
    key,
    workspace,
    location,
    description,
    iconPath,
    command,
    contextValue,
    tooltip,
  }: ConfigItemParams) {
    super(label, collapsibleState)
    this.key = key
    this.location = location
    this.description = description
    this.iconPath = iconPath
    this.command = command
    this.contextValue = contextValue
    this.workspace = workspace
    this.tooltip = tooltip
  }
}

export type ExplorerWorkspace = {
  configPath: string
  config: any
  plugins: any[]
  error?: { message: string } | { message: string; file: string; line: number }
}

export type ExplorerWorkspaces = Record<string, ExplorerWorkspace>

function isActualKey(key: string): boolean {
  return !key.startsWith('__twlsp_locations__')
}

function getLocation(
  config: any,
  key: string[]
): { file: string; range: Range } | undefined {
  let location: [string, number, number, number, number]
  let parent = dlv(config, key.slice(0, key.length - 1))
  for (let k in parent) {
    if (
      k.startsWith('__twlsp_locations__') &&
      parent[k][key[key.length - 1]] &&
      !parent[k][key[key.length - 1]][0].includes('node_modules')
    ) {
      location = parent[k][key[key.length - 1]]
    }
  }
  if (!location) return undefined
  return {
    file: location[0],
    range: new Range(
      new Position(location[1], location[2]),
      new Position(location[3], location[4])
    ),
  }
}

export class TailwindDataProvider implements TreeDataProvider<ConfigItem> {
  private _onDidChangeTreeData: EventEmitter<ConfigItem | null> = new EventEmitter<ConfigItem | null>()
  readonly onDidChangeTreeData: Event<ConfigItem | null> = this
    ._onDidChangeTreeData.event

  private context: ExtensionContext
  private workspaces: ExplorerWorkspaces = {}
  private expandedWorkspaces: string[] = []
  private treeView: TreeView<ConfigItem>

  constructor(context: ExtensionContext) {
    this.context = context

    context.subscriptions.push(
      commands.registerCommand(
        'tailwindcss.revealConfigEntry',
        ({ location }: ConfigItem) => {
          window.showTextDocument(Uri.file(location.file), {
            selection: new Range(
              new Position(
                location.range.start.line,
                location.range.start.character
              ),
              new Position(
                location.range.end.line,
                location.range.end.character
              )
            ),
          })
        }
      )
    )

    context.subscriptions.push(
      commands.registerCommand(
        'tailwindcss.viewConfigError',
        ({ contextValue }: ConfigItem) => {
          const match = contextValue.match(
            /^error:(?<file>.*?):(?<line>[0-9]+)$/
          )
          if (match === null) return
          const position = new Position(parseInt(match.groups.line, 10), 0)
          window.showTextDocument(Uri.file(match.groups.file), {
            selection: new Range(position, position),
          })
        }
      )
    )

    context.subscriptions.push(
      commands.registerCommand(
        'tailwindcss.openConfigFile',
        async (item?: ConfigItem) => {
          if (item) {
            const match = item.contextValue.match(/^config:(?<file>.*?)$/)
            if (match === null) return
            window.showTextDocument(
              await Workspace.openTextDocument(match.groups.file)
            )
          } else {
            window.showTextDocument(
              await Workspace.openTextDocument(
                this.workspaces[Object.keys(this.workspaces)[0]].configPath
              )
            )
          }
        }
      )
    )

    context.subscriptions.push(
      commands.registerCommand(
        'tailwindcss.openPluginHomepage',
        (item: ConfigItem) => {
          const match = item.contextValue.match(/^plugin:(?<url>.*?)$/)
          if (match === null) return
          commands.executeCommand('vscode.open', Uri.parse(match.groups.url))
        }
      )
    )

    Workspace.onDidChangeWorkspaceFolders(() => {
      this.refresh()
    })
  }

  private enable(): void {
    commands.executeCommand(
      'setContext',
      'tailwindcssConfigExplorerEnabled',
      true
    )
  }

  private disable(): void {
    commands.executeCommand(
      'setContext',
      'tailwindcssConfigExplorerEnabled',
      false
    )
  }

  private async createColorIcon(color: string) {
    const folder = path.resolve(this.context.storagePath, 'swatches')
    await fs.promises.mkdir(folder, { recursive: true })
    const fullPath = path.resolve(
      this.context.storagePath,
      `swatches/${crypto.createHash('sha1').update(color).digest('hex')}.svg`
    )
    if (await fileExists(fullPath)) {
      return fullPath
    }
    await fs.promises.writeFile(
      fullPath,
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16"><rect x="2" y="2" width="12" height="12" stroke="black" stroke-width="1" fill="${color}" /></svg>`,
      'utf8'
    )
    return fullPath
  }

  public setTreeView(treeView: TreeView<ConfigItem>): void {
    this.treeView = treeView
    this.treeView.onDidExpandElement(({ element }) => {
      if (!element.key && element.workspace) {
        this.expandedWorkspaces.push(element.workspace)
        this.refresh()
      }
    })
    this.treeView.onDidCollapseElement(({ element }) => {
      if (!element.key && element.workspace) {
        this.expandedWorkspaces.splice(
          this.expandedWorkspaces.indexOf(element.workspace),
          1
        )
        this.refresh()
      }
    })
  }

  public addWorkspace({
    client,
    emitter,
  }: {
    client: LanguageClient
    emitter: NotificationEmitter
  }) {
    let folder = client.clientOptions.workspaceFolder.uri.toString()
    this.expandedWorkspaces.push(folder)

    const onUpdate = async ({
      configPath,
      config: originalConfig,
      plugins,
    }) => {
      this.workspaces[folder] = {
        configPath,
        config: originalConfig,
        plugins,
      }

      try {
        this.workspaces[folder].config = (
          await emitter.emit('configWithLocations', {})
        ).config
      } catch (_) {}

      this.refresh()
    }

    const onError = async (error) => {
      this.workspaces[folder].error = error
      this.refresh()
    }

    emitter.on('configUpdated', onUpdate)
    emitter.on('configError', onError)

    client.onDidChangeState(({ newState }) => {
      if (newState === ClientState.Stopped) {
        delete this.workspaces[folder]
        this.refresh()
      }
    })
  }

  public refresh(): void {
    this._onDidChangeTreeData.fire()
    if (Object.keys(this.workspaces).length > 0) {
      this.enable()
    } else {
      this.disable()
    }
  }

  getTreeItem(element: ConfigItem): ConfigItem {
    return element
  }

  getTopLevel(workspace: string): ConfigItem[] {
    let { config, error } = this.workspaces[workspace]

    if (error) {
      return [
        new ConfigItem({
          label: `Error: ${error.message}`,
          iconPath: new ThemeIcon('warning'),
          collapsibleState: TreeItemCollapsibleState.None,
          contextValue:
            'file' in error ? `error:${error.file}:${error.line}` : undefined,
        }),
      ]
    }

    return Object.keys(config)
      .filter(isActualKey)
      .map((key) => {
        const isExpandable = key === 'plugins' || isObject(config[key])
        const location = getLocation(config, [key])

        return new ConfigItem({
          label: key,
          key: [key],
          location,
          collapsibleState: isExpandable
            ? TreeItemCollapsibleState.Collapsed
            : TreeItemCollapsibleState.None,
          description: isExpandable
            ? undefined
            : configValueToString(config[key]),
          tooltip: isExpandable
            ? undefined
            : configValueToString(config[key], true),
          contextValue: location ? 'revealable' : undefined,
          workspace,
        })
      })
  }

  async getChildren(element: ConfigItem): Promise<ConfigItem[]> {
    if (!this.workspaces) return []

    if (element) {
      if (element.key) {
        let { plugins, config } = this.workspaces[element.workspace]

        if (element.key.length === 1 && element.key[0] === 'plugins') {
          return plugins.map(
            (plugin, i) =>
              new ConfigItem({
                label: plugin.name || '(anonymous)',
                description: plugin.version ? `v${plugin.version}` : undefined,
                key: ['plugins', i.toString()],
                workspace: element.workspace,
                tooltip: plugin.description,
                contextValue: plugin.homepage
                  ? `plugin:${plugin.homepage}`
                  : undefined,
                collapsibleState: TreeItemCollapsibleState.None,
              })
          )
        }

        let item = dlv(config, element.key)
        return Promise.all(
          Object.keys(item)
            .filter(isActualKey)
            .map(async (key) => {
              let isExpandable = isObject(item[key])
              let location = getLocation(config, [...element.key, key])
              let child = new ConfigItem({
                label: key,
                key: element.key.concat(key),
                location,
                collapsibleState: isExpandable
                  ? TreeItemCollapsibleState.Collapsed
                  : TreeItemCollapsibleState.None,
                description: isExpandable
                  ? undefined
                  : configValueToString(item[key]),
                tooltip: isExpandable
                  ? undefined
                  : configValueToString(item[key], true),
                contextValue: location ? 'revealable' : undefined,
                workspace: element.workspace,
              })

              if (getColorFromValue(item[key])) {
                child.iconPath = await this.createColorIcon(item[key].trim())
              }

              return child
            })
        )
      }

      return this.getTopLevel(element.workspace)
    }

    // top-level
    if (
      Object.keys(this.workspaces).length === 1 &&
      Workspace.workspaceFolders.length < 2
    ) {
      return this.getTopLevel(Object.keys(this.workspaces)[0])
    }

    return Object.keys(this.workspaces).map((workspace) => {
      return new ConfigItem({
        label: path.basename(workspace),
        collapsibleState: TreeItemCollapsibleState.Expanded,
        workspace,
        contextValue: `config:${this.workspaces[workspace].configPath}`,
        iconPath: new ThemeIcon(
          this.expandedWorkspaces.includes(workspace)
            ? 'root-folder-opened'
            : 'root-folder'
        ),
      })
    })
  }
}

export function registerConfigExplorer({
  context,
}: {
  context: ExtensionContext
}): TailwindDataProvider {
  let provider = new TailwindDataProvider(context)

  provider.setTreeView(
    window.createTreeView('tailwindcssConfigExplorer', {
      treeDataProvider: provider,
      showCollapseAll: true,
    })
  )

  return provider
}
