import { window, workspace, ExtensionContext, TextEditor } from 'vscode'
import { NotificationEmitter } from './emitter'
import { LanguageClient } from 'vscode-languageclient'
import debounce from 'debounce'

const colorDecorationType = window.createTextEditorDecorationType({
  before: {
    width: '0.8em',
    height: '0.8em',
    contentText: ' ',
    border: '0.1em solid',
    margin: '0.1em 0.2em 0',
  },
  dark: {
    before: {
      borderColor: '#eeeeee',
    },
  },
  light: {
    before: {
      borderColor: '#000000',
    },
  },
})

export function registerColorDecorator(
  client: LanguageClient,
  context: ExtensionContext,
  emitter: NotificationEmitter
) {
  let activeEditor = window.activeTextEditor

  async function updateDecorations() {
    return updateDecorationsInEditor(activeEditor)
  }

  async function updateDecorationsInEditor(editor: TextEditor) {
    if (!editor) return
    if (editor.document.uri.scheme !== 'file') return

    let workspaceFolder = workspace.getWorkspaceFolder(editor.document.uri)
    if (
      !workspaceFolder ||
      workspaceFolder.uri.toString() !==
        client.clientOptions.workspaceFolder.uri.toString()
    ) {
      return
    }

    let preference =
      workspace.getConfiguration('tailwindCSS', editor.document)
        .colorDecorators || 'inherit'

    let enabled: boolean =
      preference === 'inherit'
        ? Boolean(workspace.getConfiguration('editor').colorDecorators)
        : preference === 'on'

    if (!enabled) {
      editor.setDecorations(colorDecorationType, [])
      return
    }

    let { colors } = await emitter.emit('getDocumentColors', {
      document: editor.document.uri.toString(),
    })

    editor.setDecorations(
      colorDecorationType,
      colors
        .filter(({ color }) => color !== 'rgba(0, 0, 0, 0.01)')
        .map(({ range, color }) => ({
          range,
          renderOptions: { before: { backgroundColor: color } },
        }))
    )
  }

  const triggerUpdateDecorations = debounce(updateDecorations, 200)

  if (activeEditor) {
    triggerUpdateDecorations()
  }

  window.onDidChangeActiveTextEditor(
    (editor) => {
      activeEditor = editor
      if (editor) {
        triggerUpdateDecorations()
      }
    },
    null,
    context.subscriptions
  )

  workspace.onDidChangeTextDocument(
    (event) => {
      if (activeEditor && event.document === activeEditor.document) {
        triggerUpdateDecorations()
      }
    },
    null,
    context.subscriptions
  )

  workspace.onDidOpenTextDocument(
    (document) => {
      if (activeEditor && document === activeEditor.document) {
        triggerUpdateDecorations()
      }
    },
    null,
    context.subscriptions
  )

  workspace.onDidChangeConfiguration((e) => {
    if (
      e.affectsConfiguration('editor.colorDecorators') ||
      e.affectsConfiguration('tailwindCSS.colorDecorators')
    ) {
      window.visibleTextEditors.forEach(updateDecorationsInEditor)
    }
  })

  emitter.on('configUpdated', () => {
    window.visibleTextEditors.forEach(updateDecorationsInEditor)
  })

  emitter.on('configError', () => {
    window.visibleTextEditors.forEach(updateDecorationsInEditor)
  })
}
