import { State } from '../util/state'
import {
  CompletionItem,
  CompletionItemKind,
  CompletionParams,
  Range,
  MarkupKind,
  CompletionList,
} from 'vscode-languageserver'
const dlv = require('dlv')
import removeMeta from '../util/removeMeta'
import { getColor, getColorFromString } from '../util/color'
import { isHtmlContext } from '../util/html'
import { isCssContext } from '../util/css'
import { findLast, findJsxStrings, arrFindLast } from '../util/find'
import { stringifyConfigValue } from '../util/stringify'
import isObject from '../util/isObject'

function completionsFromClassList(
  state: State,
  classList: string,
  classListRange: Range
): CompletionList {
  let classNames = classList.split(/[\s+]/)
  const partialClassName = classNames[classNames.length - 1]
  // TODO
  let sep = ':'
  let parts = partialClassName.split(sep)
  let subset: any
  let isSubset: boolean = false

  let replacementRange = {
    ...classListRange,
    start: {
      ...classListRange.start,
      character: classListRange.end.character - partialClassName.length,
    },
  }

  for (let i = parts.length - 1; i > 0; i--) {
    let keys = parts.slice(0, i).filter(Boolean)
    subset = dlv(state.classNames.classNames, keys)
    if (typeof subset !== 'undefined' && typeof subset.__rule === 'undefined') {
      isSubset = true
      replacementRange = {
        ...replacementRange,
        start: {
          ...replacementRange.start,
          character:
            replacementRange.start.character +
            keys.join(sep).length +
            sep.length,
        },
      }
      break
    }
  }

  return {
    isIncomplete: false,
    items: Object.keys(isSubset ? subset : state.classNames.classNames).map(
      (className) => {
        let kind: CompletionItemKind = CompletionItemKind.Constant
        let documentation: string = null
        if (isContextItem(state, [className])) {
          kind = CompletionItemKind.Module
        } else {
          const color = getColor(state, [className])
          if (color) {
            kind = CompletionItemKind.Color
            documentation = color
          }
        }

        return {
          label: className,
          kind,
          documentation,
          textEdit: {
            newText: className,
            range: replacementRange,
          },
        }
      }
    ),
  }
}

function provideClassAttributeCompletions(
  state: State,
  { context, position, textDocument }: CompletionParams
): CompletionList {
  let doc = state.editor.documents.get(textDocument.uri)
  let str = doc.getText({
    start: { line: Math.max(position.line - 10, 0), character: 0 },
    end: position,
  })

  const match = findLast(/\bclass(?:Name)?=(?<initial>['"`{])/gi, str)

  if (match === null) {
    return null
  }

  const rest = str.substr(match.index + match[0].length)

  if (match.groups.initial === '{') {
    const strings = findJsxStrings('{' + rest)
    const lastOpenString = arrFindLast(
      strings,
      (string) => typeof string.end === 'undefined'
    )
    if (lastOpenString) {
      const classList = str.substr(
        str.length - rest.length + lastOpenString.start - 1
      )
      return completionsFromClassList(state, classList, {
        start: {
          line: position.line,
          character: position.character - classList.length,
        },
        end: position,
      })
    }
    return null
  }

  if (rest.indexOf(match.groups.initial) !== -1) {
    return null
  }

  return completionsFromClassList(state, rest, {
    start: {
      line: position.line,
      character: position.character - rest.length,
    },
    end: position,
  })
}

function provideAtApplyCompletions(
  state: State,
  { context, position, textDocument }: CompletionParams
): CompletionList {
  let doc = state.editor.documents.get(textDocument.uri)
  let str = doc.getText({
    start: { line: Math.max(position.line - 30, 0), character: 0 },
    end: position,
  })

  const match = findLast(/@apply\s+(?<classList>[^;}]*)$/gi, str)

  if (match === null) {
    return null
  }

  const classList = match.groups.classList

  return completionsFromClassList(state, classList, {
    start: {
      line: position.line,
      character: position.character - classList.length,
    },
    end: position,
  })
}

function provideClassNameCompletions(
  state: State,
  params: CompletionParams
): CompletionList {
  let doc = state.editor.documents.get(params.textDocument.uri)

  if (isHtmlContext(doc, params.position)) {
    return provideClassAttributeCompletions(state, params)
  }

  if (isCssContext(doc, params.position)) {
    return provideAtApplyCompletions(state, params)
  }

  return null
}

function provideCssHelperCompletions(
  state: State,
  { position, textDocument }: CompletionParams
): CompletionList {
  let doc = state.editor.documents.get(textDocument.uri)

  if (!isCssContext(doc, position)) {
    return null
  }

  let text = doc.getText({
    start: { line: position.line, character: 0 },
    // read one extra character so we can see if it's a ] later
    end: { line: position.line, character: position.character + 1 },
  })

  const match = text
    .substr(0, text.length - 1) // don't include that extra character from earlier
    .match(/\b(?<helper>config|theme)\(['"](?<keys>[^'"]*)$/)

  if (match === null) {
    return null
  }

  let base =
    match.groups.helper === 'config'
      ? state.config
      : dlv(state.config, 'theme', {})
  let parts = match.groups.keys.split(/([\[\].]+)/)
  let keys = parts.filter((_, i) => i % 2 === 0)
  let separators = parts.filter((_, i) => i % 2 !== 0)
  // let obj =
  //   keys.length === 1 ? base : dlv(base, keys.slice(0, keys.length - 1), {})

  // if (!isObject(obj)) return null

  function totalLength(arr: string[]): number {
    return arr.reduce((acc, cur) => acc + cur.length, 0)
  }

  let obj: any
  let offset: number = 0
  let separator: string = separators.length
    ? separators[separators.length - 1]
    : null

  if (keys.length === 1) {
    obj = base
  } else {
    for (let i = keys.length - 1; i > 0; i--) {
      let o = dlv(base, keys.slice(0, i))
      if (isObject(o)) {
        obj = o
        offset = totalLength(parts.slice(i * 2))
        separator = separators[i - 1]
        break
      }
    }
  }

  if (!obj) return null

  return {
    isIncomplete: false,
    items: Object.keys(obj).map((item) => {
      let color = getColorFromString(obj[item])
      const replaceDot: boolean =
        item.indexOf('.') !== -1 && separator && separator.endsWith('.')
      const insertClosingBrace: boolean =
        text.charAt(text.length - 1) !== ']' &&
        (replaceDot || (separator && separator.endsWith('[')))

      return {
        label: item,
        filterText: `${replaceDot ? '.' : ''}${item}`,
        kind: color
          ? CompletionItemKind.Color
          : isObject(obj[item])
          ? CompletionItemKind.Module
          : CompletionItemKind.Property,
        detail: stringifyConfigValue(obj[item]),
        documentation: color,
        textEdit: {
          newText: `${replaceDot ? '[' : ''}${item}${
            insertClosingBrace ? ']' : ''
          }`,
          range: {
            start: {
              line: position.line,
              character:
                position.character -
                keys[keys.length - 1].length -
                (replaceDot ? 1 : 0) -
                offset,
            },
            end: position,
          },
        },
        data: 'helper',
      }
    }),
  }
}

export function provideCompletions(
  state: State,
  params: CompletionParams
): CompletionList {
  if (state === null) return { items: [], isIncomplete: false }

  return (
    provideClassNameCompletions(state, params) ||
    provideCssHelperCompletions(state, params)
  )
}

export function resolveCompletionItem(
  state: State,
  item: CompletionItem
): CompletionItem {
  if (item.data === 'helper') {
    return item
  }

  const className = state.classNames.classNames[item.label]
  if (isContextItem(state, [item.label])) {
    item.detail = state.classNames.context[item.label].join(', ')
  } else {
    item.detail = getCssDetail(state, className)
    if (!item.documentation) {
      item.documentation = stringifyCss(className)
      if (item.detail === item.documentation) {
        item.documentation = null
      } else {
        // item.documentation = {
        //   kind: MarkupKind.Markdown,
        //   value: ['```css', item.documentation, '```'].join('\n')
        // }
      }
    }
  }
  return item
}

function isContextItem(state: State, keys: string[]): boolean {
  const item = dlv(state.classNames.classNames, keys)
  return Boolean(
    !item.__rule &&
      !Array.isArray(item) &&
      state.classNames.context[keys[keys.length - 1]]
  )
}

function stringifyDecls(obj: any): string {
  return Object.keys(obj)
    .map((prop) => {
      return `${prop}: ${obj[prop]};`
    })
    .join(' ')
}

function stringifyCss(obj: any, indent: number = 0): string {
  let indentStr = '  '.repeat(indent)
  if (obj.__decls === true) {
    return Object.keys(removeMeta(obj))
      .reduce((acc, curr, i) => {
        return `${acc}${i === 0 ? '' : '\n'}${indentStr}${curr}: ${obj[curr]};`
      }, '')
      .trim()
  }
  return Object.keys(removeMeta(obj))
    .reduce((acc, curr, i) => {
      return `${acc}${i === 0 ? '' : '\n'}${indentStr}${curr} {\n${stringifyCss(
        obj[curr],
        indent + 2
      )}\n${indentStr}}`
    }, '')
    .trim()
}

function getCssDetail(state: State, className: any): string {
  if (Array.isArray(className)) {
    return `${className.length} rules`
  }
  let withoutMeta = removeMeta(className)
  if (className.__decls === true) {
    return stringifyDecls(withoutMeta)
  }
  let keys = Object.keys(withoutMeta)
  if (keys.length === 1) {
    return getCssDetail(state, className[keys[0]])
  }
  return `${keys.length} rules`
}
