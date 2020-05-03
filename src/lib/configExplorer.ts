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
const mkdirp = require('mkdirp')
import * as path from 'path'
import * as fs from 'fs'
import * as util from 'util'
import * as crypto from 'crypto'
import { getColorFromString } from '../lsp/util/color'
import isObject from '../util/isObject'
import { LanguageClient } from 'vscode-languageclient'
import mitt from 'mitt'

const writeFile = util.promisify(fs.writeFile)
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
    await mkdirp(folder)
    const fullPath = path.resolve(
      this.context.storagePath,
      `swatches/${crypto.createHash('sha1').update(color).digest('hex')}.svg`
    )
    if (await fileExists(fullPath)) {
      console.log('exists')
      return fullPath
    }
    await writeFile(
      fullPath,
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16"><rect x="3.45" y="3.45" width="9.1" height="9.1" fill="${color}" /><rect x="2.8" y="2.8" width="10.4" height="10.4" fill="none" stroke="black" stroke-width="1.3" /></svg>`,
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
  getTreeItem(element: ConfigItem): ConfigItem {
    return element
  }
  async getChildren(element: ConfigItem): Promise<ConfigItem[]> {
    let command = {
      command: 'tailwindcss.jumpToConfig',
      title: 'Jump to config',
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
      let children = Object.keys(item).map((key) => {
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

        if (getColorFromString(item[key])) {
          return this.createColorIcon(item[key].trim()).then((iconPath) => {
            child.iconPath = iconPath
            return child
          })
        }

        return child
      })
      return Promise.all(children)
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

export function createConfigExplorer({
  path,
  context,
  config,
  plugins,
}: DataProviderParams): (params: DataProviderParams) => void {
  let provider = new TailwindDataProvider({ path, context, config, plugins })

  commands.registerCommand('tailwindcss.openConfigFile', async () => {
    window.showTextDocument(await workspace.openTextDocument(path))
  })

  commands.registerCommand('tailwindcss.openDocs', (item: ConfigItem) => {
    commands.executeCommand(
      'vscode.open',
      Uri.parse(getDocsUrl(item.key, plugins))
    )
  })

  window.createTreeView('tailwindcssConfigExplorer', {
    treeDataProvider: provider,
    showCollapseAll: true,
  })

  commands.executeCommand(
    'setContext',
    'tailwindcssConfigExplorerEnabled',
    true
  )

  return ({ path, context, config, plugins }) =>
    provider.refresh({ path, context, config, plugins })
}

export function registerConfigExplorer({
  client,
  context,
}: {
  client: LanguageClient
  context: ExtensionContext
}): void {
  let refreshConfigExplorer

  client.onNotification(
    'tailwindcss/configUpdated',
    (path, config, plugins) => {
      if (refreshConfigExplorer) {
        refreshConfigExplorer({ path, context, config, plugins })
      } else {
        refreshConfigExplorer = createConfigExplorer({
          path,
          context,
          config,
          plugins,
        })
      }
    }
  )

  const emitter = mitt()

  commands.registerCommand('tailwindcss.jumpToConfig', (key) => {
    client.sendNotification('tailwindcss/findDefinition', [key])
    function handle(result) {
      if (JSON.stringify(result.key) !== JSON.stringify(key)) return
      emitter.off('tailwindcss/foundDefinition', handle)

      window.showTextDocument(Uri.file(result.file), {
        selection: new Range(
          new Position(result.range.start.line, result.range.start.character),
          new Position(result.range.end.line, result.range.end.character)
        ),
      })
    }
    emitter.on('tailwindcss/foundDefinition', handle)
  })

  client.onNotification(
    'tailwindcss/foundDefinition',
    (key, { file, range }) => {
      emitter.emit('tailwindcss/foundDefinition', { key, file, range })
    }
  )
}
