import { createState, getDefaultTailwindSettings, Settings } from './state'
import { TextDocument } from 'vscode-languageserver-textdocument'
import type { DeepPartial } from '../types'
import dedent from 'dedent'

export const js = dedent
export const jsx = dedent
export const ts = dedent
export const tsx = dedent
export const css = dedent
export const html = dedent
export const pug = dedent

export function createDocument({
  name,
  lang,
  content,
  settings,
}: {
  name: string
  lang: string
  content: string | string[]
  settings?: DeepPartial<Settings>
}) {
  let doc = TextDocument.create(
    `file://${name}`,
    lang,
    1,
    typeof content === 'string' ? content : content.join('\n'),
  )
  let defaults = getDefaultTailwindSettings()
  settings ??= {}
  let state = createState({
    editor: {
      getConfiguration: async () => ({
        ...defaults,
        ...settings,
        tailwindCSS: {
          ...defaults.tailwindCSS,
          ...settings.tailwindCSS,
          lint: {
            ...defaults.tailwindCSS.lint,
            ...(settings.tailwindCSS?.lint ?? {}),
          },
          experimental: {
            ...defaults.tailwindCSS.experimental,
            ...(settings.tailwindCSS?.experimental ?? {}),
          },
          files: {
            ...defaults.tailwindCSS.files,
            ...(settings.tailwindCSS?.files ?? {}),
          },
        },
        editor: {
          ...defaults.editor,
          ...settings.editor,
        },
      }),
    },
  })

  return {
    doc,
    state,
  }
}
