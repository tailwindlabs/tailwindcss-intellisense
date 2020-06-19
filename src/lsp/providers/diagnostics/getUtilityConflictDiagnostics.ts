import { joinWithAnd } from '../../util/joinWithAnd'
import { State, Settings } from '../../util/state'
import { TextDocument, DiagnosticSeverity } from 'vscode-languageserver'
import { UtilityConflictsDiagnostic, DiagnosticKind } from './types'
import {
  findClassListsInDocument,
  getClassNamesInClassList,
} from '../../util/find'
import { getClassNameDecls } from '../../util/getClassNameDecls'
import { getClassNameMeta } from '../../util/getClassNameMeta'
import { equal } from '../../../util/array'

export function getUtilityConflictDiagnostics(
  state: State,
  document: TextDocument,
  settings: Settings
): UtilityConflictsDiagnostic[] {
  let severity = settings.lint.utilityConflicts
  if (severity === 'ignore') return []

  let diagnostics: UtilityConflictsDiagnostic[] = []
  const classLists = findClassListsInDocument(state, document)

  classLists.forEach((classList) => {
    const classNames = getClassNamesInClassList(classList)

    classNames.forEach((className, index) => {
      let decls = getClassNameDecls(state, className.className)
      if (!decls) return

      let properties = Object.keys(decls)
      let meta = getClassNameMeta(state, className.className)

      let otherClassNames = classNames.filter((_className, i) => i !== index)

      let conflictingClassNames = otherClassNames.filter((otherClassName) => {
        let otherDecls = getClassNameDecls(state, otherClassName.className)
        if (!otherDecls) return false

        let otherMeta = getClassNameMeta(state, otherClassName.className)

        return (
          equal(properties, Object.keys(otherDecls)) &&
          !Array.isArray(meta) &&
          !Array.isArray(otherMeta) &&
          equal(meta.context, otherMeta.context) &&
          equal(meta.pseudo, otherMeta.pseudo)
        )
      })

      if (conflictingClassNames.length === 0) return

      diagnostics.push({
        code: DiagnosticKind.UtilityConflicts,
        className,
        otherClassNames: conflictingClassNames,
        range: className.range,
        severity:
          severity === 'error'
            ? DiagnosticSeverity.Error
            : DiagnosticSeverity.Warning,
        message: `'${className.className}' applies the same CSS ${
          properties.length === 1 ? 'property' : 'properties'
        } as ${joinWithAnd(
          conflictingClassNames.map(
            (conflictingClassName) => `'${conflictingClassName.className}'`
          )
        )}.`,
        relatedInformation: conflictingClassNames.map(
          (conflictingClassName) => {
            return {
              message: conflictingClassName.className,
              location: {
                uri: document.uri,
                range: conflictingClassName.range,
              },
            }
          }
        ),
      })
    })
  })

  return diagnostics
}
