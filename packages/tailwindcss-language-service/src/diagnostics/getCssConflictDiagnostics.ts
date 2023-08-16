import { joinWithAnd } from '../util/joinWithAnd'
import { State, Settings } from '../util/state'
import { CssConflictDiagnostic, DiagnosticKind } from './types'
import { findClassListsInDocument, getClassNamesInClassList } from '../util/find'
import { getClassNameDecls } from '../util/getClassNameDecls'
import { getClassNameMeta } from '../util/getClassNameMeta'
import { equal } from '../util/array'
import * as jit from '../util/jit'
import type { AtRule, Node, Rule } from 'postcss'
import type { TextDocument } from 'vscode-languageserver-textdocument'

function isCustomProperty(property: string): boolean {
  return property.startsWith('--')
}

function isAtRule(node: Node): node is AtRule {
  return node.type === 'atrule'
}

function isKeyframes(rule: Rule): boolean {
  let parent = rule.parent
  if (!parent) {
    return false
  }
  if (isAtRule(parent) && parent.name === 'keyframes') {
    return true
  }
  return false
}

function getRuleProperties(rule: Rule): string[] {
  let properties: string[] = []
  rule.walkDecls(({ prop }) => {
    properties.push(prop)
  })
  // if (properties.findIndex((p) => !isCustomProperty(p)) > -1) {
  //   properties = properties.filter((p) => !isCustomProperty(p))
  // }
  return properties
}

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
    const classNames = getClassNamesInClassList(classList, state.blocklist)

    classNames.forEach((className, index) => {
      if (state.jit) {
        let { rules } = jit.generateRules(
          state,
          [className.className],
          (rule) => !isKeyframes(rule)
        )
        if (rules.length === 0) {
          return
        }

        let info: Array<{ context: string[]; properties: string[] }> = rules.map((rule) => {
          let properties = getRuleProperties(rule)
          let context = jit.getRuleContext(state, rule, className.className)
          return { context, properties }
        })

        let otherClassNames = classNames.filter((_className, i) => i !== index)

        let conflictingClassNames = otherClassNames.filter((otherClassName) => {
          let { rules: otherRules } = jit.generateRules(
            state,
            [otherClassName.className],
            (rule) => !isKeyframes(rule)
          )
          if (otherRules.length !== rules.length) {
            return false
          }

          let propertiesAreComparable = false

          for (let i = 0; i < otherRules.length; i++) {
            let otherRule = otherRules[i]
            let properties = getRuleProperties(otherRule)
            if (info[i].properties.length > 0 && properties.length > 0) {
              propertiesAreComparable = true
            }
            if (!equal(info[i].properties, properties)) {
              return false
            }
            let context = jit.getRuleContext(state, otherRule, otherClassName.className)
            if (!equal(info[i].context, context)) {
              return false
            }
          }

          if (!propertiesAreComparable) {
            return false
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
