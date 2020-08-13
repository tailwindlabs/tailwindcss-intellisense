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

// TODO
const DOCS = {
  variants: 'v1/configuration/#variants',
  plugins: 'v1/configuration/#plugins',
  corePlugins: 'v1/configuration/#core-plugins',

  prefix: 'v1/configuration/#prefix',
  important: 'v1/configuration/#important',
  separator: 'v1/configuration/#separator',
  options: {
    prefix: 'v0/configuration/#prefix',
    important: 'v0/configuration/#important',
    separator: 'v0/configuration/#separator',
  },

  screens: 'v0/responsive-design/',
  colors: 'v0/colors/',
  backgroundColors: 'v0/background-color/',
  backgroundPosition: 'v0/background-position/',

  theme: {
    _: 'v1/configuration/#theme',
    screens: 'v1/breakpoints/',
    colors: 'v1/customizing-colors/',
    spacing: 'v1/customizing-spacing/',
    container: 'v1/container/',
    backgroundColor: 'v1/background-color/',
    backgroundPosition: 'v1/background-position/',
  },
}

function getDocsUrl(key: string[], plugins: any) {
  if (key.length === 2 && key[0] === 'plugins') {
    return plugins[key[1]].homepage || null
  }

  const path = dlv(DOCS, [...key, '_'], dlv(DOCS, key))
  if (typeof path !== 'string') {
    for (let i = 0; i < plugins.length; i++) {
      if (
        plugins[i] &&
        key.length === 2 &&
        (key[0] === 'theme' || key[0] === 'variants') &&
        plugins[i].homepage &&
        dlv(plugins[i], ['contributes', key[0]], []).indexOf(key[1]) !== -1
      ) {
        return plugins[i].homepage
      }
    }
    return null
  }
  return path
    .replace(/^v0\//, 'https://v0.tailwindcss.com/docs/')
    .replace(/^v1\//, 'https://tailwindcss.com/docs/')
}

function configValueToString(value: any): string {
  if (Array.isArray(value)) {
    return value.join(', ')
  }
  return value.toString()
}

type ConfigItemParams = {
  label: string
  key: string[]
  collapsibleState: TreeItemCollapsibleState
  description?: string
  iconPath?: string
  command?: Command
  contextValue?: string
}

class ConfigItem extends TreeItem {
  public key: string[]

  constructor({
    label,
    collapsibleState,
    key,
    description,
    iconPath,
    command,
    contextValue,
  }: ConfigItemParams) {
    super(label, collapsibleState)
    this.key = key
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

    let command = {
      command: 'tailwindcss.revealConfig',
      title: 'Reveal config',
    }

    if (element) {
      if (element.key.length === 1 && element.key[0] === 'plugins') {
        return this.plugins.map((plugin, i) => ({
          label: plugin.name || 'Anonymous',
          key: ['plugins', i.toString()],
          contextValue: getDocsUrl(['plugins', i.toString()], this.plugins)
            ? 'documented'
            : undefined,
        }))
      }

      let item = dlv(this.config, element.key)
      return Promise.all(
        Object.keys(item).map(async (key) => {
          let isExpandable = isObject(item[key])
          let child = new ConfigItem({
            label: key,
            key: element.key.concat(key),
            collapsibleState: isExpandable
              ? TreeItemCollapsibleState.Collapsed
              : TreeItemCollapsibleState.None,
            description: isExpandable
              ? undefined
              : configValueToString(item[key]),
            command: isExpandable
              ? undefined
              : { ...command, arguments: [element.key.concat(key)] },
            contextValue: getDocsUrl(element.key.concat(key), this.plugins)
              ? 'documented'
              : undefined,
          })

          if (getColorFromValue(item[key])) {
            child.iconPath = await this.createColorIcon(item[key].trim())
          }

          return child
        })
      )
    }

    return Object.keys(this.config).map((key) => {
      const isExpandable = key === 'plugins' || isObject(this.config[key])

      return new ConfigItem({
        label: key,
        key: [key],
        collapsibleState: isExpandable
          ? TreeItemCollapsibleState.Collapsed
          : TreeItemCollapsibleState.None,
        description: isExpandable
          ? undefined
          : configValueToString(this.config[key]),
        command: isExpandable ? undefined : { ...command, arguments: [[key]] },
        contextValue: getDocsUrl([key], this.plugins)
          ? 'documented'
          : undefined,
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
  let provider = new TailwindDataProvider({ path, context, config, plugins })

  let openConfigCommand = commands.registerCommand(
    'tailwindcss.openConfigFile',
    async () => {
      window.showTextDocument(await workspace.openTextDocument(path))
    }
  )

  commands.registerCommand('tailwindcss.openDocs', (item: ConfigItem) => {
    commands.executeCommand(
      'vscode.open',
      Uri.parse(getDocsUrl(item.key, plugins))
    )
  })

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
      openConfigCommand.dispose()
      openConfigCommand = commands.registerCommand(
        'tailwindcss.openConfigFile',
        async () => {
          window.showTextDocument(await workspace.openTextDocument(path))
        }
      )
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

  emitter.on('configUpdated', ({ configPath, config, plugins }) => {
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
  })

  emitter.on('configError', async ({ message }) => {
    if (configExplorer) {
      configExplorer.clear(`Error loading configuration: ${message}`)
    }
  })

  commands.registerCommand('tailwindcss.revealConfig', async (key) => {
    let result = await emitter.emit('findDefinition', { key })
    if (result.error) {
    } else {
      window.showTextDocument(Uri.file(result.file), {
        selection: new Range(
          new Position(result.range.start.line, result.range.start.character),
          new Position(result.range.end.line, result.range.end.character)
        ),
      })
    }
  })
}
