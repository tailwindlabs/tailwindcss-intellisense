import { joinWithAnd } from '../util/joinWithAnd'
import type { State, Settings, DocumentClassName } from '../util/state'
import { type CssConflictDiagnostic, DiagnosticKind } from './types'
import { findClassListsInDocument, getClassNamesInClassList } from '../util/find'
import { getClassNameDecls } from '../util/getClassNameDecls'
import { getClassNameMeta } from '../util/getClassNameMeta'
import { equal } from '../util/array'
import * as jit from '../util/jit'
import * as postcss from 'postcss'
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
  settings: Settings,
): Promise<CssConflictDiagnostic[]> {
  let severity = settings.tailwindCSS.lint.cssConflict
  if (severity === 'ignore') return []

  let diagnostics: CssConflictDiagnostic[] = []
  const classLists = await findClassListsInDocument(state, document)

  classLists.forEach((classList) => {
    const classNames = getClassNamesInClassList(classList, state.blocklist)

    if (state.v4) {
      const groups = recordClassDetails(state, classNames)

      for (let [className, conflictingClassNames] of findConflicts(classNames, groups)) {
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
              (conflictingClassName) => `'${conflictingClassName.className}'`,
            ),
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
      }

      return
    }

    classNames.forEach((className, index) => {
      if (state.jit) {
        let { rules } = jit.generateRules(
          state,
          [className.className],
          (rule) => !isKeyframes(rule),
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
            (rule) => !isKeyframes(rule),
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
              (conflictingClassName) => `'${conflictingClassName.className}'`,
            ),
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
          conflictingClassNames.map(
            (conflictingClassName) => `'${conflictingClassName.className}'`,
          ),
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

interface RuleEntry {
  properties: string[]
  context: string[]
}

type ClassDetails = Record<string, RuleEntry[]>

export function visit(
  nodes: postcss.AnyNode[],
  cb: (node: postcss.AnyNode, path: postcss.AnyNode[]) => void,
  path: postcss.AnyNode[] = [],
): void {
  for (let child of nodes) {
    path = [...path, child]
    cb(child, path)
    if ('nodes' in child && child.nodes && child.nodes.length > 0) {
      visit(child.nodes, cb, path)
    }
  }
}

function recordClassDetails(state: State, classes: DocumentClassName[]): ClassDetails {
  const groups: Record<string, RuleEntry[]> = {}

  let roots = state.designSystem.compile(classes.map((c) => c.className))

  // Get all the properties for each class
  for (let [idx, root] of roots.entries()) {
    let { className } = classes[idx]

    visit([root], (node, path) => {
      if (node.type !== 'rule' && node.type !== 'atrule') return

      let properties: string[] = []

      for (let child of node.nodes ?? []) {
        if (child.type !== 'decl') continue
        properties.push(child.prop)
      }

      if (properties.length === 0) return

      // We have to slice off the first `context` item because it's the class name and that's always different
      groups[className] ??= []
      groups[className].push({
        properties,
        context: path
          .map((node) => {
            if (node.type === 'rule') {
              return node.selector
            } else if (node.type === 'atrule') {
              return `@${node.name} ${node.params}`
            }
            return ''
          })
          .filter(Boolean)
          .slice(1),
      })
    })
  }

  return groups
}

function* findConflicts(
  classes: DocumentClassName[],
  groups: ClassDetails,
): Iterable<[DocumentClassName, DocumentClassName[]]> {
  // Compare each class to each other
  // If they have the same properties and context, they are conflicting and we should report it
  for (let className of classes) {
    let entries = groups[className.className] ?? []
    let conflictingClassNames: DocumentClassName[] = []

    for (let otherClassName of classes) {
      if (className === otherClassName) continue

      let otherEntries = groups[otherClassName.className] ?? []

      // There is _some_ difference so we can skip this
      if (entries.length !== otherEntries.length) continue

      let hasConflict = false

      for (let i = 0; i < entries.length; i++) {
        let entry = entries[i]
        let otherEntry = otherEntries[i]

        // Different number of properties so no conflict is happening
        if (entry.properties.length !== otherEntry.properties.length) {
          hasConflict = false
          break
        }

        // Different depth of context so no conflict is happening
        if (entry.context.length !== otherEntry.context.length) {
          hasConflict = false
          break
        }

        // Different properties so no conflict is happening
        if (!equal(entry.properties, otherEntry.properties)) {
          hasConflict = false
          break
        }

        // Different context so no conflict is happening
        if (!equal(entry.context, otherEntry.context)) {
          hasConflict = false
          break
        }

        // If there are no properties keep checking
        if (entry.properties.length === 0 && otherEntry.properties.length === 0) {
          continue
        }

        hasConflict = true
      }

      if (!hasConflict) continue

      conflictingClassNames.push(otherClassName)
    }

    if (conflictingClassNames.length === 0) continue

    yield [className, conflictingClassNames]
  }
}
