import {
  TreeDataProvider,
  TreeItem,
  TreeItemCollapsibleState,
  window as Window,
  Command,
  Event,
  EventEmitter
} from 'vscode'
import { getSvgColorFromValue, createTempFile } from './util'
import dlv from 'dlv'
import * as path from 'path'

const ICONS = {
  colors: 'palette.svg',
  backgroundColors: 'palette.svg',
  borderColors: 'palette.svg',
  textColors: 'palette.svg',
  svgFill: 'palette.svg',
  svgStroke: 'palette.svg',
  screens: 'devices.svg',
  textSizes: 'format_size.svg',
  fonts: 'title.svg',
  fontWeights: 'format_bold.svg',
  zIndex: 'layers.svg',
  borderWidths: 'border_all.svg',
  shadows: 'flip_to_front.svg',
  borderRadius: 'rounded_corner.svg',
  width: 'straighten.svg',
  minWidth: 'straighten.svg',
  maxWidth: 'straighten.svg',
  height: 'straighten.svg',
  minHeight: 'straighten.svg',
  maxHeight: 'straighten.svg',
  opacity: 'opacity.svg',
  leading: 'format_line_spacing.svg',
  backgroundSize: 'photo_size_select_large.svg',
  padding: 'padding.svg',
  margin: 'select_all.svg',
  negativeMargin: 'select_all.svg',
  tracking: 'tracking.svg'
}

function configValueToString(value: any): string {
  if (Array.isArray(value)) {
    return value.join(', ')
  }
  return value.toString()
}

function isObject(val: any): boolean {
  return val != null && typeof val === 'object' && Array.isArray(val) === false
}

class ConfigItem extends TreeItem {
  constructor(
    public label: string,
    public key: string[],
    public collapsibleState: TreeItemCollapsibleState,
    public description?: string,
    public iconPath?: string,
    public command?: Command
  ) {
    super(label, collapsibleState)
    this.key = key
    this.description = description
    this.iconPath = iconPath
  }
}

class TailwindDataProvider implements TreeDataProvider<ConfigItem> {
  private _onDidChangeTreeData: EventEmitter<ConfigItem | null> = new EventEmitter<ConfigItem | null>()
  readonly onDidChangeTreeData: Event<ConfigItem | null> = this
    ._onDidChangeTreeData.event

  private config: any

  constructor(public configPath: string) {
    this.config = require(configPath)
  }
  public refresh(configPath?: string): void {
    if (configPath) this.configPath = configPath
    delete require.cache[this.configPath]
    this.config = require(this.configPath)
    this._onDidChangeTreeData.fire()
  }
  getTreeItem(element: ConfigItem): ConfigItem {
    return element
  }
  async getChildren(element: ConfigItem): Promise<ConfigItem[]> {
    let command = {
      command: 'tailwindcss.goToDefinition',
      title: 'Go To Definition'
    }
    if (element) {
      let item = dlv(this.config, element.key)
      let children = Object.keys(item).map(key => {
        let isObj = isObject(item[key])
        let child = new ConfigItem(
          key,
          element.key.concat(key),
          isObj
            ? TreeItemCollapsibleState.Collapsed
            : TreeItemCollapsibleState.None,
          isObj ? undefined : configValueToString(item[key]),
          undefined,
          isObj ? undefined : command
        )
        let color = getSvgColorFromValue(item[key])

        if (color) {
          return createTempFile(
            `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16"><rect x="3.45" y="3.45" width="9.1" height="9.1" fill="${color}" /><rect x="2.8" y="2.8" width="10.4" height="10.4" fill="none" stroke="black" stroke-width="1.3" /></svg>`,
            { postfix: '.svg' }
          ).then(iconPath => {
            child.iconPath = iconPath
            return child
          })
        }

        return child
      })
      return Promise.all(children)
    }

    return Object.keys(this.config)
      .filter(key => ['modules', 'plugins', 'options'].indexOf(key) === -1)
      .map(
        key =>
          new ConfigItem(
            key,
            [key],
            isObject(this.config[key])
              ? TreeItemCollapsibleState.Collapsed
              : TreeItemCollapsibleState.None,
            isObject(this.config[key])
              ? undefined
              : configValueToString(this.config[key]),
            ICONS[key]
              ? path.join(
                  __filename,
                  '..',
                  '..',
                  'resources',
                  'icons',
                  ICONS[key]
                )
              : undefined,
            isObject(this.config[key]) ? undefined : command
          )
      )
  }
}

function treeDataProvider1(config): TreeDataProvider<TreeItem> {
  return {
    getChildren: async (element): Promise<TreeItem[]> => {
      if (element) {
        let child = dlv(config, element.label, {})
        let items = Object.keys(child).map(key => {
          let color = getSvgColorFromValue(child[key])

          if (color) {
            return createTempFile(
              `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16"><rect x="3.45" y="3.45" width="9.1" height="9.1" fill="${color}" /><rect x="2.8" y="2.8" width="10.4" height="10.4" fill="none" stroke="black" stroke-width="1.3" /></svg>`,
              { postfix: '.svg' }
            ).then(iconPath => ({
              label: key,
              description: configValueToString(child[key]),
              iconPath
            }))
          }

          return Promise.resolve({
            label: key,
            description: configValueToString(child[key])
          })
        })
        return Promise.all(items)
      }

      return Object.keys(config)
        .filter(key => ['modules', 'plugins', 'options'].indexOf(key) === -1)
        .map(key => ({
          label: key,
          collapsibleState: isObject(config[key])
            ? TreeItemCollapsibleState.Collapsed
            : TreeItemCollapsibleState.None,
          description: isObject(config[key])
            ? undefined
            : configValueToString(config[key]),
          iconPath: ICONS[key]
            ? path.join(
                __filename,
                '..',
                '..',
                'resources',
                'icons',
                ICONS[key]
              )
            : undefined
        }))
    },
    getTreeItem: (element: TreeItem): TreeItem => {
      return element
    }
  }
}

export function createTreeView(configPath) {
  let provider = new TailwindDataProvider(configPath)
  let view = Window.createTreeView('tailwindcssConfigExplorer', {
    treeDataProvider: provider,
    showCollapseAll: true
  })
  view.reveal(undefined)

  return () => provider.refresh()
}
