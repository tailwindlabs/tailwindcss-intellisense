import {
  CodeAction,
  CodeActionParams,
  CodeActionKind,
  Range,
  TextEdit,
} from 'vscode-languageserver'
import { State } from '../../util/state'
import { findLast } from '../../util/find'
import { isWithinRange } from '../../util/isWithinRange'
import { getClassNameParts } from '../../util/getClassNameAtPosition'
const dlv = require('dlv')
import dset from 'dset'
import { removeRangeFromString } from '../../util/removeRangeFromString'
import detectIndent from 'detect-indent'
import { cssObjToAst } from '../../util/cssObjToAst'
import isObject from '../../../util/isObject'
import { getDiagnostics } from '../diagnostics/diagnosticsProvider'
import { rangesEqual } from '../../util/rangesEqual'
import {
  DiagnosticKind,
  isInvalidApplyDiagnostic,
  AugmentedDiagnostic,
  InvalidApplyDiagnostic,
  isUtilityConflictsDiagnostic,
  UtilityConflictsDiagnostic,
} from '../diagnostics/types'
import { flatten, dedupeBy } from '../../../util/array'

async function getDiagnosticsFromCodeActionParams(
  state: State,
  params: CodeActionParams,
  only?: DiagnosticKind[]
): Promise<AugmentedDiagnostic[]> {
  let document = state.editor.documents.get(params.textDocument.uri)
  let diagnostics = await getDiagnostics(state, document, only)

  return params.context.diagnostics
    .map((diagnostic) => {
      return diagnostics.find((d) => {
        return (
          d.code === diagnostic.code &&
          d.message === diagnostic.message &&
          rangesEqual(d.range, diagnostic.range)
        )
      })
    })
    .filter(Boolean)
}

export async function provideCodeActions(
  state: State,
  params: CodeActionParams
): Promise<CodeAction[]> {
  let codes = params.context.diagnostics
    .map((diagnostic) => diagnostic.code)
    .filter(Boolean) as DiagnosticKind[]

  let diagnostics = await getDiagnosticsFromCodeActionParams(
    state,
    params,
    codes
  )

  let actions = diagnostics.map((diagnostic) => {
    if (isInvalidApplyDiagnostic(diagnostic)) {
      return provideInvalidApplyCodeActions(state, params, diagnostic)
    }

    if (isUtilityConflictsDiagnostic(diagnostic)) {
      return provideUtilityConflictsCodeActions(state, params, diagnostic)
    }

    let match = findLast(
      / Did you mean (?:something like )?'(?<replacement>[^']+)'\?$/g,
      diagnostic.message
    )

    if (!match) {
      return []
    }

    return [
      {
        title: `Replace with '${match.groups.replacement}'`,
        kind: CodeActionKind.QuickFix,
        diagnostics: [diagnostic],
        edit: {
          changes: {
            [params.textDocument.uri]: [
              {
                range: diagnostic.range,
                newText: match.groups.replacement,
              },
            ],
          },
        },
      },
    ]
  })

  return Promise.all(actions)
    .then(flatten)
    .then((x) => dedupeBy(x, (item) => JSON.stringify(item.edit)))
}

function classNameToAst(
  state: State,
  className: string,
  selector: string = `.${className}`,
  important: boolean = false
) {
  const parts = getClassNameParts(state, className)
  if (!parts) {
    return null
  }
  const baseClassName = dlv(
    state.classNames.classNames,
    parts[parts.length - 1]
  )
  if (!baseClassName) {
    return null
  }
  const info = dlv(state.classNames.classNames, parts)
  let context = info.__context || []
  let pseudo = info.__pseudo || []
  const globalContexts = state.classNames.context
  let screens = dlv(
    state.config,
    'theme.screens',
    dlv(state.config, 'screens', {})
  )
  if (!isObject(screens)) screens = {}
  screens = Object.keys(screens)
  const path = []

  for (let i = 0; i < parts.length - 1; i++) {
    let part = parts[i]
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
  let rule = {
    // TODO: use proper selector parser
    [selector + pseudo.join('')]: {
      [`@apply ${parts[parts.length - 1]}${
        important ? ' !important' : ''
      }`]: '',
    },
  }
  if (path.length) {
    dset(obj, path, rule)
  } else {
    obj = rule
  }

  return cssObjToAst(obj, state.modules.postcss)
}

async function provideUtilityConflictsCodeActions(
  state: State,
  params: CodeActionParams,
  diagnostic: UtilityConflictsDiagnostic
): Promise<CodeAction[]> {
  return [
    {
      title: `Delete '${diagnostic.className.className}'`,
      kind: CodeActionKind.QuickFix,
      diagnostics: [diagnostic],
      edit: {
        changes: {
          [params.textDocument.uri]: [
            {
              range: diagnostic.className.classList.range,
              newText: removeRangeFromString(
                diagnostic.className.classList.classList,
                diagnostic.className.relativeRange
              ),
            },
          ],
        },
      },
    },
    {
      title: `Delete '${diagnostic.otherClassName.className}'`,
      kind: CodeActionKind.QuickFix,
      diagnostics: [diagnostic],
      edit: {
        changes: {
          [params.textDocument.uri]: [
            {
              range: diagnostic.className.classList.range,
              newText: removeRangeFromString(
                diagnostic.className.classList.classList,
                diagnostic.otherClassName.relativeRange
              ),
            },
          ],
        },
      },
    },
  ]
}

async function provideInvalidApplyCodeActions(
  state: State,
  params: CodeActionParams,
  diagnostic: InvalidApplyDiagnostic
): Promise<CodeAction[]> {
  let document = state.editor.documents.get(params.textDocument.uri)
  let documentText = document.getText()
  const { postcss } = state.modules
  let change: TextEdit

  let totalClassNamesInClassList = diagnostic.className.classList.classList.split(
    /\s+/
  ).length

  await postcss([
    postcss.plugin('', (_options = {}) => {
      return (root) => {
        root.walkRules((rule) => {
          if (change) return false

          rule.walkAtRules('apply', (atRule) => {
            let { start, end } = atRule.source
            let range: Range = {
              start: {
                line: start.line - 1,
                character: start.column - 1,
              },
              end: {
                line: end.line - 1,
                character: end.column - 1,
              },
            }

            if (!isWithinRange(diagnostic.range.start, range)) {
              // keep looking
              return true
            }

            let className = document.getText(diagnostic.range)
            let ast = classNameToAst(
              state,
              className,
              rule.selector,
              diagnostic.className.classList.important
            )

            if (!ast) {
              return false
            }

            rule.after(ast.nodes)
            let insertedRule = rule.next()

            if (totalClassNamesInClassList === 1) {
              atRule.remove()
            }

            let outputIndent: string
            let documentIndent = detectIndent(documentText)

            change = {
              range: {
                start: {
                  line: rule.source.start.line - 1,
                  character: rule.source.start.column - 1,
                },
                end: {
                  line: rule.source.end.line - 1,
                  character: rule.source.end.column,
                },
              },
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
                  }),
            }

            return false
          })
        })
      }
    }),
  ]).process(documentText, { from: undefined })

  if (!change) {
    return []
  }

  return [
    {
      title: 'Extract to new rule',
      kind: CodeActionKind.QuickFix,
      diagnostics: [diagnostic],
      edit: {
        changes: {
          [params.textDocument.uri]: [
            ...(totalClassNamesInClassList > 1
              ? [
                  {
                    range: diagnostic.className.classList.range,
                    newText: removeRangeFromString(
                      diagnostic.className.classList.classList,
                      diagnostic.className.relativeRange
                    ),
                  },
                ]
              : []),
            change,
          ],
        },
      },
    },
  ]
}
