import {
  TextDocument,
  Diagnostic,
  DiagnosticSeverity,
} from 'vscode-languageserver'
import { State } from '../util/state'
import { isCssDoc } from '../util/css'
import { findClassNamesInRange } from '../util/find'
import { getClassNameMeta } from '../util/getClassNameMeta'

function provideCssDiagnostics(state: State, document: TextDocument): void {
  const classNames = findClassNamesInRange(document, undefined, 'css')

  let diagnostics: Diagnostic[] = classNames
    .map(({ className, range }) => {
      const meta = getClassNameMeta(state, className)
      if (!meta) return null

      let message: string

      if (Array.isArray(meta)) {
        message = `\`@apply\` cannot be used with \`.${className}\` because it is included in multiple rulesets.`
      } else if (meta.source !== 'utilities') {
        message = `\`@apply\` cannot be used with \`.${className}\` because it is not a utility.`
      } else if (meta.context && meta.context.length > 0) {
        if (meta.context.length === 1) {
          message = `\`@apply\` cannot be used with \`.${className}\` because it is nested inside of an at-rule (${meta.context[0]}).`
        } else {
          message = `\`@apply\` cannot be used with \`.${className}\` because it is nested inside of at-rules (${meta.context.join(
            ', '
          )}).`
        }
      } else if (meta.pseudo && meta.pseudo.length > 0) {
        if (meta.pseudo.length === 1) {
          message = `\`@apply\` cannot be used with \`.${className}\` because its definition includes a pseudo-selector (${meta.pseudo[0]})`
        } else {
          message = `\`@apply\` cannot be used with \`.${className}\` because its definition includes pseudo-selectors (${meta.pseudo.join(
            ', '
          )})`
        }
      }

      if (!message) return null

      return {
        severity: DiagnosticSeverity.Error,
        range,
        message,
        // source: 'ex',
      }
    })
    .filter(Boolean)

  // if (state.editor.capabilities.diagnosticRelatedInformation) {
  //   diagnostic.relatedInformation = [
  //     {
  //       location: {
  //         uri: document.uri,
  //         range: Object.assign({}, diagnostic.range),
  //       },
  //       message: '',
  //     },
  //     {
  //       location: {
  //         uri: document.uri,
  //         range: Object.assign({}, diagnostic.range),
  //       },
  //       message: '',
  //     },
  //   ]
  // }

  state.editor.connection.sendDiagnostics({ uri: document.uri, diagnostics })
}

export async function provideDiagnostics(
  state: State,
  document: TextDocument
): Promise<void> {
  if (isCssDoc(state, document)) {
    return provideCssDiagnostics(state, document)
  }
}
