'use strict'

import * as vscode from 'vscode'
import { join } from 'path'
const tailwindClassNames = require('tailwind-class-names')
// const tailwindClassNames = require('/Users/brad/Code/tailwind-class-names/dist')
const dlv = require('dlv')

export async function activate(context: vscode.ExtensionContext) {
  if (!vscode.workspace.name) return

  const configFile = await vscode.workspace.findFiles(
    '{tailwind,tailwind.config,.tailwindrc}.js',
    '**/node_modules/**',
    1
  )
  if (!configFile) return

  const plugin = join(
    vscode.workspace.workspaceFolders[0].uri.fsPath,
    'node_modules',
    'tailwindcss'
  )

  let tw

  try {
    tw = await tailwindClassNames(
      configFile[0].fsPath,
      {
        tree: true,
        strings: true
      },
      plugin
    )
  } catch (err) {
    return
  }

  const separator = dlv(tw.config, 'options.separator', ':')

  if (separator !== ':') return

  const items = createItems(tw.classNames, separator, tw.config)

  context.subscriptions.push(
    createCompletionItemProvider(
      items,
      ['typescriptreact', 'javascript', 'javascriptreact'],
      /\btw`([^`]*)$/,
      ['`', ' ', separator],
      tw.config
    )
  )

  context.subscriptions.push(
    createCompletionItemProvider(
      items,
      ['css', 'sass', 'scss'],
      /@apply ([^;}]*)$/,
      ['.', separator],
      tw.config,
      '.'
    )
  )

  context.subscriptions.push(
    createCompletionItemProvider(
      items,
      [
        'html',
        'jade',
        'razor',
        'php',
        'blade',
        'vue',
        'twig',
        'markdown',
        'erb',
        'handlebars',
        'ejs',
        // for jsx
        'typescriptreact',
        'javascript',
        'javascriptreact'
      ],
      /\bclass(Name)?=["']([^"']*)/, // /\bclass(Name)?=(["'])(?!.*?\2)/
      ["'", '"', ' ', separator],
      tw.config
    )
  )
}

export function deactivate() {}

function createCompletionItemProvider(
  items,
  languages: string[],
  regex: RegExp,
  triggerCharacters: string[],
  config,
  prefix = ''
): vscode.Disposable {
  return vscode.languages.registerCompletionItemProvider(
    languages,
    {
      provideCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position
      ): vscode.CompletionItem[] {
        const range: vscode.Range = new vscode.Range(
          new vscode.Position(Math.max(position.line - 5, 0), 0),
          position
        )
        const text: string = document.getText(range)

        let p = prefix
        const separator = config.options.separator || ':'

        const matches = text.match(regex)

        if (matches) {
          const parts = matches[matches.length - 1].split(' ')
          const str = parts[parts.length - 1]

          const pth = str
            .replace(new RegExp(`${separator}`, 'g'), '.')
            .replace(/\.$/, '')
            .replace(/^\./, '')
            .replace(/\./g, '.children.')

          if (pth !== '') {
            const itms = dlv(items, pth)
            if (itms) {
              return prefixItems(itms.children, str, prefix)
            }
          }

          return prefixItems(items, str, prefix)
        }

        return []
      }
    },
    ...triggerCharacters
  )
}

function prefixItems(items, str, prefix) {
  const addPrefix =
    typeof prefix !== 'undefined' && prefix !== '' && str === prefix

  return Object.keys(items).map(x => {
    const item = items[x].item
    if (addPrefix) {
      item.filterText = item.insertText = `${prefix}${item.label}`
    } else {
      item.filterText = item.insertText = item.label
    }
    return item
  })
}

function depthOf(obj) {
  if (typeof obj !== 'object') return 0

  let level = 1

  for (let key in obj) {
    if (!obj.hasOwnProperty(key)) continue

    if (typeof obj[key] === 'object') {
      const depth = depthOf(obj[key]) + 1
      level = Math.max(depth, level)
    }
  }

  return level
}

function createItems(classNames, separator, config, parent = '') {
  let items = {}

  Object.keys(classNames).forEach(key => {
    if (depthOf(classNames[key]) === 0) {
      const item = new vscode.CompletionItem(
        key,
        vscode.CompletionItemKind.Constant
      )
      if (key !== 'container' && key !== 'group') {
        if (parent) {
          item.detail = classNames[key].replace(
            new RegExp(`:${parent} \{(.*?)\}`),
            '$1'
          )
        } else {
          item.detail = classNames[key]
        }
      }
      items[key] = {
        item
      }
    } else {
      console.log(key)
      const item = new vscode.CompletionItem(
        `${key}${separator}`,
        vscode.CompletionItemKind.Constant
      )
      item.command = { title: '', command: 'editor.action.triggerSuggest' }
      if (key === 'hover' || key === 'focus' || key === 'active') {
        item.detail = `:${key}`
      } else if (key === 'group-hover') {
        item.detail = '.group:hover &'
      } else if (
        config.screens &&
        Object.keys(config.screens).indexOf(key) !== -1
      ) {
        item.detail = `@media (min-width: ${config.screens[key]})`
      }
      items[key] = {
        item,
        children: createItems(classNames[key], separator, config, key)
      }
    }
  })

  return items
}
