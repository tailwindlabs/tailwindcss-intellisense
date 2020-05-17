import {
  TextDocument,
  Diagnostic,
  DiagnosticSeverity,
} from 'vscode-languageserver'
import { State } from '../util/state'
import { isCssDoc } from '../util/css'
import { findClassNamesInRange } from '../util/find'
import { getClassNameParts } from '../util/getClassNameAtPosition'
const dlv = require('dlv')

function provideCssDiagnostics(state: State, document: TextDocument): void {
  const classNames = findClassNamesInRange(document, undefined, 'css')

  let diagnostics: Diagnostic[] = classNames
    .map(({ className, range }) => {
      const parts = getClassNameParts(state, className)
      if (!parts) return null

      const info = dlv(state.classNames.classNames, parts)
      let message: string

      if (Array.isArray(info)) {
        message = `\`@apply\` cannot be used with \`.${className}\` because it is included in multiple rulesets.`
      } else if (info.__source !== 'utilities') {
        message = `\`@apply\` cannot be used with \`.${className}\` because it is not a utility.`
      } else if (info.__context && info.__context.length > 0) {
        if (info.__context.length === 1) {
          message = `\`@apply\` cannot be used with \`.${className}\` because it is nested inside of an at-rule (${info.__context[0]}).`
        } else {
          message = `\`@apply\` cannot be used with \`.${className}\` because it is nested inside of at-rules (${info.__context.join(
            ', '
          )}).`
        }
      } else if (info.__pseudo && info.__pseudo.length > 0) {
        if (info.__pseudo.length === 1) {
          message = `\`@apply\` cannot be used with \`.${className}\` because its definition includes a pseudo-selector (${info.__pseudo[0]})`
        } else {
          message = `\`@apply\` cannot be used with \`.${className}\` because its definition includes pseudo-selectors (${info.__pseudo.join(
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
