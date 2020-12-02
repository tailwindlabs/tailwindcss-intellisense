import type {
  CodeAction,
  CodeActionParams,
  TextEdit,
  Range,
} from 'vscode-languageserver'
import { State } from '../util/state'
import { InvalidApplyDiagnostic } from '../diagnostics/types'
import { isCssDoc } from '../util/css'
import { getLanguageBoundaries } from '../util/getLanguageBoundaries'
import { getClassNameMeta } from '../util/getClassNameMeta'
import { getClassNameParts } from '../util/getClassNameAtPosition'
import { validateApply } from '../util/validateApply'
import { isWithinRange } from '../util/isWithinRange'
const dlv = require('dlv')
import type { Root, NodeSource } from 'postcss'
import { absoluteRange } from '../util/absoluteRange'
import { removeRangesFromString } from '../util/removeRangesFromString'
import detectIndent from 'detect-indent'
import isObject from '../util/isObject'
import { cssObjToAst } from '../util/cssObjToAst'
import dset from 'dset'
import selectorParser from 'postcss-selector-parser'
import { flatten } from '../util/array'

export async function provideInvalidApplyCodeActions(
  state: State,
  params: CodeActionParams,
  diagnostic: InvalidApplyDiagnostic
): Promise<CodeAction[]> {
  let document = state.editor.documents.get(params.textDocument.uri)
  let documentText = document.getText()
  let cssRange: Range
  let cssText = documentText
  const { postcss } = state.modules
  let changes: TextEdit[] = []

  let totalClassNamesInClassList = diagnostic.className.classList.classList.split(
    /\s+/
  ).length

  let className = diagnostic.className.className
  let classNameParts = getClassNameParts(state, className)
  let classNameInfo = dlv(state.classNames.classNames, classNameParts)

  if (Array.isArray(classNameInfo)) {
    return []
  }

  if (!isCssDoc(state, document)) {
    let languageBoundaries = getLanguageBoundaries(state, document)
    if (!languageBoundaries) return []
    cssRange = languageBoundaries.css.find((range) =>
      isWithinRange(diagnostic.range.start, range)
    )
    if (!cssRange) return []
    cssText = document.getText(cssRange)
  }

  try {
    await postcss([
      postcss.plugin('', (_options = {}) => {
        return (root: Root) => {
          root.walkRules((rule) => {
            if (changes.length) return false

            rule.walkAtRules('apply', (atRule) => {
              let atRuleRange = postcssSourceToRange(atRule.source)
              if (cssRange) {
                atRuleRange = absoluteRange(atRuleRange, cssRange)
              }

              if (!isWithinRange(diagnostic.range.start, atRuleRange))
                return true

              let ast = classNameToAst(
                state,
                classNameParts,
                rule.selector,
                diagnostic.className.classList.important
              )

              if (!ast) return false

              rule.after(ast.nodes)
              let insertedRule = rule.next()
              if (!insertedRule) return false

              if (totalClassNamesInClassList === 1) {
                atRule.remove()
              } else {
                changes.push({
                  range: diagnostic.className.classList.range,
                  newText: removeRangesFromString(
                    diagnostic.className.classList.classList,
                    diagnostic.className.relativeRange
                  ),
                })
              }

              let ruleRange = postcssSourceToRange(rule.source)
              if (cssRange) {
                ruleRange = absoluteRange(ruleRange, cssRange)
              }

              let outputIndent: string
              let documentIndent = detectIndent(cssText)

              changes.push({
                range: ruleRange,
                newText:
                  rule.toString() +
                  (insertedRule.raws.before || '\n\n') +
                  insertedRule
                    .toString()
                    .replace(/\n\s*\n/g, '\n')
                    .replace(/(@apply [^;\n]+)$/gm, '$1;')
                    .replace(/([^\s^]){$/gm, '$1 {')
                    .replace(/^\s+/gm, (m: string) => {
                      if (typeof outputIndent === 'undefined') outputIndent = m
                      return m.replace(
                        new RegExp(outputIndent, 'g'),
                        documentIndent.indent
                      )
                    })
                    .replace(/^(\s+)(.*?[^{}]\n)([^\s}])/gm, '$1$2$1$3'),
              })

              return false
            })

            return true
          })
        }
      }),
    ]).process(cssText, { from: undefined })
  } catch (_) {
    return []
  }

  if (!changes.length) {
    return []
  }

  return [
    {
      title: 'Extract to new rule',
      kind: 'quickfix', // CodeActionKind.QuickFix,
      diagnostics: [diagnostic],
      edit: {
        changes: {
          [params.textDocument.uri]: changes,
        },
      },
    },
  ]
}

function postcssSourceToRange(source: NodeSource): Range {
  return {
    start: {
      line: source.start.line - 1,
      character: source.start.column - 1,
    },
    end: {
      line: source.end.line - 1,
      character: source.end.column,
    },
  }
}

function classNameToAst(
  state: State,
  classNameParts: string[],
  selector: string,
  important: boolean = false
) {
  const baseClassName = classNameParts[classNameParts.length - 1]
  const validatedBaseClassName = validateApply(state, [baseClassName])
  if (
    validatedBaseClassName === null ||
    validatedBaseClassName.isApplyable === false
  ) {
    return null
  }
  const meta = getClassNameMeta(state, classNameParts)
  if (Array.isArray(meta)) return null
  let context = meta.context
  let pseudo = meta.pseudo
  const globalContexts = state.classNames.context
  let screens = dlv(
    state.config,
    'theme.screens',
    dlv(state.config, 'screens', {})
  )
  if (!isObject(screens)) screens = {}
  screens = Object.keys(screens)
  const path = []

  for (let i = 0; i < classNameParts.length - 1; i++) {
    let part = classNameParts[i]
    let common = globalContexts[part]
    if (!common) return null
    if (screens.includes(part)) {
      path.push(`@screen ${part}`)
      context = context.filter((con) => !common.includes(con))
    }
  }

  path.push(...context)

  let obj = {}
  for (let i = 1; i <= path.length; i++) {
    dset(obj, path.slice(0, i), {})
  }

  selector = appendPseudosToSelector(selector, pseudo)
  if (selector === null) return null

  let rule = {
    [selector]: {
      [`@apply ${baseClassName}${important ? ' !important' : ''}`]: '',
    },
  }
  if (path.length) {
    dset(obj, path, rule)
  } else {
    obj = rule
  }

  return cssObjToAst(obj, state.modules.postcss)
}

function appendPseudosToSelector(
  selector: string,
  pseudos: string[]
): string | null {
  if (pseudos.length === 0) return selector

  let canTransform = true

  let transformedSelector = selectorParser((selectors) => {
    flatten(selectors.split((_) => true)).forEach((sel) => {
      // @ts-ignore
      for (let i = sel.nodes.length - 1; i >= 0; i--) {
        // @ts-ignore
        if (sel.nodes[i].type !== 'pseudo') {
          break
          // @ts-ignore
        } else if (pseudos.includes(sel.nodes[i].value)) {
          canTransform = false
          break
        }
      }
      if (canTransform) {
        pseudos.forEach((p) => {
          // @ts-ignore
          sel.append(selectorParser.pseudo({ value: p }))
        })
      }
    })
  }).processSync(selector)

  if (!canTransform) return null

  return transformedSelector
}
