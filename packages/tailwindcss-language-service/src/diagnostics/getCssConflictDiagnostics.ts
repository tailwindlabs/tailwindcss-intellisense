import { joinWithAnd } from '../util/joinWithAnd'
import { State, Settings } from '../util/state'
import type { TextDocument, DiagnosticSeverity } from 'vscode-languageserver'
import { CssConflictDiagnostic, DiagnosticKind } from './types'
import { findClassListsInDocument, getClassNamesInClassList } from '../util/find'
import { getClassNameDecls } from '../util/getClassNameDecls'
import { getClassNameMeta } from '../util/getClassNameMeta'
import { equal } from '../util/array'
import * as jit from '../util/jit'

export async function getCssConflictDiagnostics(
  state: State,
  document: TextDocument,
  settings: Settings
): Promise<CssConflictDiagnostic[]> {
  let severity = settings.tailwindCSS.lint.cssConflict
  if (severity === 'ignore') return []

  let diagnostics: CssConflictDiagnostic[] = []
  const classLists = await findClassListsInDocument(state, document)

  classLists.forEach((classList) => {
    const classNames = getClassNamesInClassList(classList)

    classNames.forEach((className, index) => {
      if (state.jit) {
        let { rules } = jit.generateRules(state, [className.className])
        if (rules.length === 0) {
          return
        }

        let info: Array<{ context: string[]; properties: string[] }> = rules.map((rule) => {
          let properties: string[] = []
          rule.walkDecls(({ prop }) => {
            properties.push(prop)
          })
          let context = jit.getRuleContext(state, rule, className.className)
          return { context, properties }
        })

        let otherClassNames = classNames.filter((_className, i) => i !== index)

        let conflictingClassNames = otherClassNames.filter((otherClassName) => {
          let { rules: otherRules } = jit.generateRules(state, [otherClassName.className])
          if (otherRules.length !== rules.length) {
            return false
          }

          for (let i = 0; i < otherRules.length; i++) {
            let rule = otherRules[i]
            let properties: string[] = []
            rule.walkDecls(({ prop }) => {
              properties.push(prop)
            })
            if (!equal(info[i].properties, properties)) {
              return false
            }
            let context = jit.getRuleContext(state, rule, otherClassName.className)
            if (!equal(info[i].context, context)) {
              return false
            }
          }

          return true
        })

        if (conflictingClassNames.length === 0) return

        diagnostics.push({
          code: DiagnosticKind.CssConflict,
          className,
          otherClassNames: conflictingClassNames,
          range: className.range,
          severity:
            severity === 'error'
              ? 1 /* DiagnosticSeverity.Error */
              : 2 /* DiagnosticSeverity.Warning */,
          message: `'${className.className}' applies the same CSS properties as ${joinWithAnd(
            conflictingClassNames.map(
              (conflictingClassName) => `'${conflictingClassName.className}'`
            )
          )}.`,
          relatedInformation: conflictingClassNames.map((conflictingClassName) => {
            return {
              message: conflictingClassName.className,
              location: {
                uri: document.uri,
                range: conflictingClassName.range,
              },
            }
          }),
        })

        return
      }

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
          equal(meta.pseudo, otherMeta.pseudo) &&
          meta.scope === otherMeta.scope
        )
      })

      if (conflictingClassNames.length === 0) return

      diagnostics.push({
        code: DiagnosticKind.CssConflict,
        className,
        otherClassNames: conflictingClassNames,
        range: className.range,
        severity:
          severity === 'error'
            ? 1 /* DiagnosticSeverity.Error */
            : 2 /* DiagnosticSeverity.Warning */,
        message: `'${className.className}' applies the same CSS ${
          properties.length === 1 ? 'property' : 'properties'
        } as ${joinWithAnd(
          conflictingClassNames.map((conflictingClassName) => `'${conflictingClassName.className}'`)
        )}.`,
        relatedInformation: conflictingClassNames.map((conflictingClassName) => {
          return {
            message: conflictingClassName.className,
            location: {
              uri: document.uri,
              range: conflictingClassName.range,
            },
          }
        }),
      })
    })
  })

  return diagnostics
}
