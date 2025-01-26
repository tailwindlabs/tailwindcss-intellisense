import type { Range, TextDocument } from 'vscode-languageserver-textdocument'
import * as jit from './util/jit'
import type { State } from './util/state'

export async function updateAnnotation(state: State, document: TextDocument): Promise<Range[]> {
  const text = document.getText()

  const extractorContext = {
    tailwindConfig: {
      separator: '-',
      prefix: '',
    },
  }
  if (state.jitContext?.tailwindConfig?.separator) {
    extractorContext.tailwindConfig.separator = state.jitContext.tailwindConfig.separator
  }
  if (state.jitContext?.tailwindConfig?.prefix) {
    extractorContext.tailwindConfig.prefix = state.jitContext.tailwindConfig.prefix
  }

  const classNames = state.modules.defaultExtractor.module(extractorContext)(text) as string[]

  const result: Range[] = []

  if (state.v4) {
    const rules = state.designSystem.compile(classNames)

    let index = 0
    classNames.forEach((className, i) => {
      const start = text.indexOf(className, index)
      const end = start + className.length
      if (rules.at(i).nodes.length > 0 && start !== -1) {
        result.push({ start: document.positionAt(start), end: document.positionAt(end) })
      }
      index = end
    })
  } else if (state.jit) {
    const rules = jit.generateRules(state, classNames).rules

    let index = 0
    classNames.forEach((className, i) => {
      const start = text.indexOf(className, index)
      const end = start + className.length
      if ((rules.at(i).raws.tailwind as any)?.candidate === className && start !== -1) {
        result.push({ start: document.positionAt(start), end: document.positionAt(end) })
      }
      index = end
    })
  }

  return result
}
