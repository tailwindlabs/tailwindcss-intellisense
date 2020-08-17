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
  workspace,
  Range,
  Position,
} from 'vscode'
const dlv = require('dlv')
import * as path from 'path'
import * as fs from 'fs'
import * as util from 'util'
import * as crypto from 'crypto'
import { getColorFromValue } from '../lsp/util/color'
import isObject from '../util/isObject'
import { NotificationEmitter } from './emitter'

const fileExists = util.promisify(fs.exists)

function configValueToString(value: unknown): string {
  if (Array.isArray(value)) {
    return value.join(', ')
  }
  return value.toString()
}

type ConfigItemParams = {
  label: string
  key: string[]
  location?: {
    file: string
    range: Range
  }
  collapsibleState: TreeItemCollapsibleState
  description?: string
  iconPath?: string
  command?: Command
  contextValue?: string
}

class ConfigItem extends TreeItem {
  public key: string[]
  public location?: {
    file: string
    range: Range
  }

  constructor({
    label,
    collapsibleState,
    key,
    location,
    description,
    iconPath,
    command,
    contextValue,
  }: ConfigItemParams) {
    super(label, collapsibleState)
    this.key = key
    this.location = location
    this.description = description
    this.iconPath = iconPath
    this.command = command
    this.contextValue = contextValue
  }
}

export type DataProviderParams = {
  path: string
  context: ExtensionContext
  config: any
  plugins: any[]
}

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

class TailwindDataProvider implements TreeDataProvider<ConfigItem> {
  private _onDidChangeTreeData: EventEmitter<ConfigItem | null> = new EventEmitter<ConfigItem | null>()
  readonly onDidChangeTreeData: Event<ConfigItem | null> = this
    ._onDidChangeTreeData.event

  private path: string
  private context: ExtensionContext
  private config: any
  private plugins: any[]

  constructor({ path, context, config, plugins }: DataProviderParams) {
    this.path = path
    this.context = context
    this.config = config
    this.plugins = plugins
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

  public refresh({ path, context, config, plugins }: DataProviderParams): void {
    if (path) this.path = path
    if (context) this.context = context
    if (config) this.config = config
    if (plugins) this.plugins = plugins
    this._onDidChangeTreeData.fire()
  }

  public clear(): void {
    this.config = null
    this._onDidChangeTreeData.fire()
  }

  getTreeItem(element: ConfigItem): ConfigItem {
    return element
  }
  async getChildren(element: ConfigItem): Promise<ConfigItem[]> {
    if (!this.config) return []

    if (element) {
      if (element.key.length === 1 && element.key[0] === 'plugins') {
        return this.plugins.map((plugin, i) => ({
          label: plugin.name || 'Anonymous',
          key: ['plugins', i.toString()],
          contextValue: plugin.homepage ? 'hasPluginHomepage' : undefined,
        }))
      }

      let item = dlv(this.config, element.key)
      return Promise.all(
        Object.keys(item)
          .filter(isActualKey)
          .map(async (key) => {
            let isExpandable = isObject(item[key])
            let location = getLocation(this.config, [...element.key, key])
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
              contextValue: location ? 'revealable' : undefined,
            })

            if (getColorFromValue(item[key])) {
              child.iconPath = await this.createColorIcon(item[key].trim())
            }

            return child
          })
      )
    }

    return Object.keys(this.config)
      .filter(isActualKey)
      .map((key) => {
        const isExpandable = key === 'plugins' || isObject(this.config[key])
        const location = getLocation(this.config, [key])

        return new ConfigItem({
          label: key,
          key: [key],
          location,
          collapsibleState: isExpandable
            ? TreeItemCollapsibleState.Collapsed
            : TreeItemCollapsibleState.None,
          description: isExpandable
            ? undefined
            : configValueToString(this.config[key]),
          contextValue: location ? 'revealable' : undefined,
        })
      })
  }
}

interface ConfigExplorerInterface {
  clear: (message?: string) => void
  refresh: (params: DataProviderParams) => void
}

export function createConfigExplorer({
  path,
  context,
  config,
  plugins,
}: DataProviderParams): ConfigExplorerInterface {
  let currentConfigPath = path
  let currentPlugins = plugins
  let provider = new TailwindDataProvider({ path, context, config, plugins })

  context.subscriptions.push(
    commands.registerCommand('tailwindcss.openConfigFile', async () => {
      window.showTextDocument(
        await workspace.openTextDocument(currentConfigPath)
      )
    })
  )

  context.subscriptions.push(
    commands.registerCommand(
      'tailwindcss.openPluginHomepage',
      (item: ConfigItem) => {
        commands.executeCommand(
          'vscode.open',
          Uri.parse(currentPlugins[item.key[item.key.length - 1]].homepage)
        )
      }
    )
  )

  let treeView = window.createTreeView('tailwindcssConfigExplorer', {
    treeDataProvider: provider,
    showCollapseAll: true,
  })

  commands.executeCommand(
    'setContext',
    'tailwindcssConfigExplorerEnabled',
    true
  )

  return {
    clear: (message?: string) => {
      provider.clear()
      treeView.message = message
    },
    refresh: ({ path, context, config, plugins }) => {
      treeView.message = undefined
      provider.refresh({ path, context, config, plugins })
      currentConfigPath = path
      currentPlugins = plugins
    },
  }
}

export function registerConfigExplorer({
  context,
  emitter,
}: {
  context: ExtensionContext
  emitter: NotificationEmitter
}): void {
  let configExplorer: ConfigExplorerInterface

  emitter.on(
    'configUpdated',
    async ({ configPath, config: originalConfig, plugins }) => {
      let config = originalConfig
      try {
        config = (await emitter.emit('configWithLocations', {})).config
      } catch (_) {}
      if (configExplorer) {
        configExplorer.refresh({ path: configPath, context, config, plugins })
      } else {
        configExplorer = createConfigExplorer({
          path: configPath,
          context,
          config,
          plugins,
        })
      }
    }
  )

  emitter.on('configError', async ({ message }) => {
    if (configExplorer) {
      configExplorer.clear(`Error loading configuration: ${message}`)
    }
  })

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
            new Position(location.range.end.line, location.range.end.character)
          ),
        })
      }
    )
  )
}
