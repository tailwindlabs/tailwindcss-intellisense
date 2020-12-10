import {
  window as Window,
  commands,
  env,
  QuickPickItem,
  ThemeIcon,
  ExtensionContext,
  Uri,
} from 'vscode'
import { searchDocs } from 'tailwindcss-language-service'
import AbortController from 'abort-controller'

interface SavedSearchItem {
  title: string
  url: string
  hierarchy: string[]
}

type SearchItem = QuickPickItem & {
  title: string
  url: string
  hierarchy: string[]
}

function augmentSavedSearchItems(items: SavedSearchItem[]): SearchItem[] {
  return items.map((item) => ({
    ...item,
    label: item.title,
    description: item.hierarchy.join(' / '),
    alwaysShow: true,
  }))
}

export function registerSearchCommand(context: ExtensionContext) {
  context.subscriptions.push(
    commands.registerCommand('tailwindCSS.search', () => {
      let controller: AbortController
      const picker = Window.createQuickPick<SearchItem>()
      // https://github.com/microsoft/vscode/issues/73904
      ;(picker as any).sortByLabel = false
      picker.title = 'History'
      picker.buttons = [
        {
          tooltip: 'Clear Search History',
          iconPath: new ThemeIcon('clear-all'),
        },
      ]
      picker.items = augmentSavedSearchItems(
        context.globalState.get<SavedSearchItem[]>('recent_searches') || []
      )
      picker.activeItems = []

      picker.onDidChangeValue(async (value) => {
        const query = value.trim()

        if (query === '') {
          picker.title = 'History'
          picker.items = augmentSavedSearchItems(
            context.globalState.get<SavedSearchItem[]>('recent_searches') || []
          )
          picker.activeItems = []
          return
        }

        if (controller) {
          controller.abort()
        }

        controller = new AbortController()

        let hits
        try {
          hits = await searchDocs(
            query,
            {
              hitsPerPage: 10,
              attributesToRetrieve: [
                'hierarchy.lvl0',
                'hierarchy.lvl1',
                'hierarchy.lvl2',
                'hierarchy.lvl3',
                'hierarchy.lvl4',
                'hierarchy.lvl5',
                'hierarchy.lvl6',
                'type',
                'url',
                'content',
              ],
              attributesToSnippet: [],
              facetFilters: 'version:v2',
              distinct: 1,
            },
            { signal: controller.signal }
          )
        } catch (_error) {
          return
        }

        if (picker.value !== value) {
          return
        }

        const tempItems = hits.map((hit) => {
          const title = hit.hierarchy[hit.type] || hit[hit.type]
          const hierarchy = Object.values(hit.hierarchy)
            .filter((_, i) => {
              if (hit.type === 'content') return true
              return i < parseInt(hit.type.substr(3), 10)
            })
            .filter(Boolean)

          return {
            title,
            label: title,
            url: hit.url,
            alwaysShow: true,
            hierarchy,
            description: hierarchy.join(' / '),
            children: [],
            moved: false,
          }
        })
        for (let i = 0; i < tempItems.length; i++) {
          const hit = tempItems[i]
          for (let j = 0; j < tempItems.length; j++) {
            if (j === i) continue
            if (
              tempItems[j].description.startsWith(
                `${hit.description} / ${hit.label}`
              )
            ) {
              tempItems[j].moved = true
              tempItems[j].label = '  ' + tempItems[j].label
              tempItems[j].description = tempItems[j].description
                .substr(`${hit.description} / ${hit.label}`.length)
                .replace(/^[ \/]+/, '')
              hit.children.push(tempItems[j])
            }
          }
        }
        const items = []
        for (let i = 0; i < tempItems.length; i++) {
          if (tempItems[i].moved) continue
          items.push(tempItems[i])
          tempItems[i].children.forEach((child) => {
            items.push(child)
          })
        }

        picker.title = 'Results'
        // picker.items = hits.map((hit, i) => ({
        //   label: (i === 1 ? '   ' : '') + hit.hierarchy[hit.type],
        //   url: hit.url,
        //   alwaysShow: true,
        //   description: Object.values(hit.hierarchy)
        //     .filter((_, i) => i < parseInt(hit.type.substr(3), 10))
        //     .filter(Boolean)
        //     .join(' / '),
        // }))
        picker.items = items
      })

      picker.onDidTriggerButton((button) => {
        if (button.tooltip === 'Clear Search History') {
          context.globalState.update('recent_searches', [])
          if (picker.value.trim() === '') {
            picker.items = []
          }
        }
      })

      picker.onDidAccept(() => {
        const item = picker.selectedItems[0]
        env.openExternal(Uri.parse(item.url))

        const recent =
          context.globalState.get<SavedSearchItem[]>('recent_searches') || []
        context.globalState.update(
          'recent_searches',
          [
            {
              title: item.title,
              url: item.url,
              hierarchy: item.hierarchy,
            },
            ...recent.filter((existingItem) => existingItem.url !== item.url),
          ].slice(0, 10)
        )
      })

      picker.show()
    })
  )
}
