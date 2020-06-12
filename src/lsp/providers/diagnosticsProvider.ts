import {
  TextDocument,
  Diagnostic,
  DiagnosticSeverity,
} from 'vscode-languageserver'
import { State, Settings } from '../util/state'
import { isCssDoc } from '../util/css'
import {
  findClassNamesInRange,
  findClassListsInDocument,
  getClassNamesInClassList,
  findAll,
  indexToPosition,
} from '../util/find'
import { getClassNameMeta } from '../util/getClassNameMeta'
import { getClassNameDecls } from '../util/getClassNameDecls'
import { equal } from '../../util/array'
import { getDocumentSettings } from '../util/getDocumentSettings'
const dlv = require('dlv')

function getUnsupportedApplyDiagnostics(
  state: State,
  document: TextDocument,
  settings: Settings
): Diagnostic[] {
  let severity = settings.lint.unsupportedApply
  if (severity === 'ignore') return []

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
        severity:
          severity === 'error'
            ? DiagnosticSeverity.Error
            : DiagnosticSeverity.Warning,
        range,
        message,
      }
    })
    .filter(Boolean)

  return diagnostics
}

function getUtilityConflictDiagnostics(
  state: State,
  document: TextDocument,
  settings: Settings
): Diagnostic[] {
  let severity = settings.lint.utilityConflicts
  if (severity === 'ignore') return []

  let diagnostics: Diagnostic[] = []
  const classLists = findClassListsInDocument(state, document)

  classLists.forEach((classList) => {
    const classNames = getClassNamesInClassList(classList)

    classNames.forEach((className, index) => {
      let otherClassNames = classNames.filter((_className, i) => i !== index)
      otherClassNames.forEach((otherClassName) => {
        let decls = getClassNameDecls(state, className.className)
        if (!decls) return

        let otherDecls = getClassNameDecls(state, otherClassName.className)
        if (!otherDecls) return

        let meta = getClassNameMeta(state, className.className)
        let otherMeta = getClassNameMeta(state, otherClassName.className)

        if (
          equal(Object.keys(decls), Object.keys(otherDecls)) &&
          !Array.isArray(meta) &&
          !Array.isArray(otherMeta) &&
          equal(meta.context, otherMeta.context) &&
          equal(meta.pseudo, otherMeta.pseudo)
        ) {
          diagnostics.push({
            range: className.range,
            severity:
              severity === 'error'
                ? DiagnosticSeverity.Error
                : DiagnosticSeverity.Warning,
            message: `You can’t use \`${className.className}\` and \`${otherClassName.className}\` together`,
            relatedInformation: [
              {
                message: otherClassName.className,
                location: {
                  uri: document.uri,
                  range: otherClassName.range,
                },
              },
            ],
          })
        }
      })
    })
  })

  return diagnostics
}

function getScreenDirectiveDiagnostics(
  state: State,
  document: TextDocument,
  settings: Settings
): Diagnostic[] {
  let severity = settings.lint.unknownScreen
  if (severity === 'ignore') return []

  let text = document.getText()
  let matches = findAll(/(?:\s|^)@screen\s+(?<screen>[^\s{]+)/g, text)

  let screens = Object.keys(
    dlv(state.config, 'theme.screens', dlv(state.config, 'screens', {}))
  )

  return matches
    .map((match) => {
      if (screens.includes(match.groups.screen)) {
        return null
      }

      return {
        range: {
          start: indexToPosition(
            text,
            match.index + match[0].length - match.groups.screen.length
          ),
          end: indexToPosition(text, match.index + match[0].length),
        },
        severity:
          severity === 'error'
            ? DiagnosticSeverity.Error
            : DiagnosticSeverity.Warning,
        message: 'Unknown screen',
      }
    })
    .filter(Boolean)
}

export async function provideDiagnostics(
  state: State,
  document: TextDocument
): Promise<void> {
  const settings = await getDocumentSettings(state, document.uri)

  const diagnostics: Diagnostic[] = settings.validate
    ? [
        ...getUtilityConflictDiagnostics(state, document, settings),
        ...(isCssDoc(state, document)
          ? [
              ...getUnsupportedApplyDiagnostics(state, document, settings),
              ...getScreenDirectiveDiagnostics(state, document, settings),
            ]
          : []),
      ]
    : []

  state.editor.connection.sendDiagnostics({
    uri: document.uri,
    diagnostics,
  })
}
