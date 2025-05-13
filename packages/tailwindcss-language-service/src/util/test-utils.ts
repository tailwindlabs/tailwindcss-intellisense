import { createState, getDefaultTailwindSettings, Settings, State } from './state'
import { TextDocument } from 'vscode-languageserver-textdocument'
import type { DeepPartial } from '../types'
import dedent, { type Dedent } from 'dedent'

export const js: Dedent = dedent
export const jsx: Dedent = dedent
export const ts: Dedent = dedent
export const tsx: Dedent = dedent
export const css: Dedent = dedent
export const html: Dedent = dedent
export const pug: Dedent = dedent

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
}): { doc: TextDocument; state: State } {
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
