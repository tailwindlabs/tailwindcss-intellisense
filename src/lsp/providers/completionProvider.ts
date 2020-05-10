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
import { getColor, getColorFromValue } from '../util/color'
import { isHtmlContext } from '../util/html'
import { isCssContext } from '../util/css'
import { findLast, findJsxStrings, arrFindLast } from '../util/find'
import { stringifyConfigValue, stringifyCss } from '../util/stringify'
import { stringifyScreen, Screen } from '../util/screens'
import isObject from '../../util/isObject'
import * as emmetHelper from 'vscode-emmet-helper-bundled'
import { isValidLocationForEmmetAbbreviation } from '../util/isValidLocationForEmmetAbbreviation'
import { getDocumentSettings } from '../util/getDocumentSettings'
import { isJsContext } from '../util/js'
import { naturalExpand } from '../util/naturalExpand'
import semver from 'semver'
import { docsUrl } from '../util/docsUrl'
import { ensureArray } from '../../util/array'

function completionsFromClassList(
  state: State,
  classList: string,
  classListRange: Range,
  filter?: (item: CompletionItem) => boolean
): CompletionList {
  let classNames = classList.split(/[\s+]/)
  const partialClassName = classNames[classNames.length - 1]
  let sep = state.separator
  let parts = partialClassName.split(sep)
  let subset: any
  let subsetKey: string[] = []
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
      subsetKey = keys
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
    items: Object.keys(isSubset ? subset : state.classNames.classNames)
      .map((className, index) => {
        let label = className
        let kind: CompletionItemKind = CompletionItemKind.Constant
        let documentation: string = null
        let command: any
        let sortText = naturalExpand(index)
        if (isContextItem(state, [...subsetKey, className])) {
          kind = CompletionItemKind.Module
          command = { title: '', command: 'editor.action.triggerSuggest' }
          label += sep
          sortText = '-' + sortText // move to top
        } else {
          const color = getColor(state, [className])
          if (color) {
            kind = CompletionItemKind.Color
            documentation = color.documentation
          }
        }

        const item = {
          label,
          kind,
          documentation,
          command,
          sortText,
          data: [...subsetKey, className],
          textEdit: {
            newText: label,
            range: replacementRange,
          },
        }

        if (filter && !filter(item)) {
          return null
        }

        return item
      })
      .filter((item) => item !== null),
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

  return completionsFromClassList(
    state,
    classList,
    {
      start: {
        line: position.line,
        character: position.character - classList.length,
      },
      end: position,
    },
    (item) => {
      // TODO: first line excludes all subtrees but there could _technically_ be
      // valid apply-able class names in there. Will be correct in 99% of cases
      if (item.kind === CompletionItemKind.Module) return false
      let info = dlv(state.classNames.classNames, item.data)
      return (
        !Array.isArray(info) &&
        info.__source === 'utilities' &&
        (info.__context || []).length === 0 &&
        (info.__pseudo || []).length === 0
      )
    }
  )
}

function provideClassNameCompletions(
  state: State,
  params: CompletionParams
): CompletionList {
  let doc = state.editor.documents.get(params.textDocument.uri)

  if (
    isHtmlContext(state, doc, params.position) ||
    isJsContext(state, doc, params.position)
  ) {
    return provideClassAttributeCompletions(state, params)
  }

  if (isCssContext(state, doc, params.position)) {
    return provideAtApplyCompletions(state, params)
  }

  return null
}

function provideCssHelperCompletions(
  state: State,
  { position, textDocument }: CompletionParams
): CompletionList {
  let doc = state.editor.documents.get(textDocument.uri)

  if (!isCssContext(state, doc, position)) {
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
    items: Object.keys(obj).map((item, index) => {
      let color = getColorFromValue(obj[item])
      const replaceDot: boolean =
        item.indexOf('.') !== -1 && separator && separator.endsWith('.')
      const insertClosingBrace: boolean =
        text.charAt(text.length - 1) !== ']' &&
        (replaceDot || (separator && separator.endsWith('[')))
      const detail = stringifyConfigValue(obj[item])

      return {
        label: item,
        filterText: `${replaceDot ? '.' : ''}${item}`,
        sortText: naturalExpand(index),
        kind: color
          ? CompletionItemKind.Color
          : isObject(obj[item])
          ? CompletionItemKind.Module
          : CompletionItemKind.Property,
        // VS Code bug causes '0' to not display in some cases
        detail: detail === '0' ? '0 ' : detail,
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

// TODO: vary docs links based on Tailwind version
function provideTailwindDirectiveCompletions(
  state: State,
  { position, textDocument }: CompletionParams
): CompletionList {
  let doc = state.editor.documents.get(textDocument.uri)

  if (!isCssContext(state, doc, position)) {
    return null
  }

  let text = doc.getText({
    start: { line: position.line, character: 0 },
    end: position,
  })

  const match = text.match(/^\s*@tailwind\s+(?<partial>[^\s]*)$/i)

  if (match === null) return null

  return {
    isIncomplete: false,
    items: [
      semver.gte(state.version, '1.0.0-beta.1')
        ? {
            label: 'base',
            documentation: {
              kind: MarkupKind.Markdown,
              value: `This injects Tailwind’s base styles and any base styles registered by plugins.\n\n[Tailwind CSS Documentation](${docsUrl(
                state.version,
                'functions-and-directives/#tailwind'
              )})`,
            },
          }
        : {
            label: 'preflight',
            documentation: {
              kind: MarkupKind.Markdown,
              value: `This injects Tailwind’s base styles, which is a combination of Normalize.css and some additional base styles.\n\n[Tailwind CSS Documentation](${docsUrl(
                state.version,
                'functions-and-directives/#tailwind'
              )})`,
            },
          },
      {
        label: 'components',
        documentation: {
          kind: MarkupKind.Markdown,
          value: `This injects Tailwind’s component classes and any component classes registered by plugins.\n\n[Tailwind CSS Documentation](${docsUrl(
            state.version,
            'functions-and-directives/#tailwind'
          )})`,
        },
      },
      {
        label: 'utilities',
        documentation: {
          kind: MarkupKind.Markdown,
          value: `This injects Tailwind’s utility classes and any utility classes registered by plugins.\n\n[Tailwind CSS Documentation](${docsUrl(
            state.version,
            'functions-and-directives/#tailwind'
          )})`,
        },
      },
      {
        label: 'screens',
        documentation: {
          kind: MarkupKind.Markdown,
          value: `Use this directive to control where Tailwind injects the responsive variations of each utility.\n\nIf omitted, Tailwind will append these classes to the very end of your stylesheet by default.\n\n[Tailwind CSS Documentation](${docsUrl(
            state.version,
            'functions-and-directives/#tailwind'
          )})`,
        },
      },
    ].map((item) => ({
      ...item,
      kind: CompletionItemKind.Constant,
      data: '@tailwind',
      textEdit: {
        newText: item.label,
        range: {
          start: {
            line: position.line,
            character: position.character - match.groups.partial.length,
          },
          end: position,
        },
      },
    })),
  }
}

function provideVariantsDirectiveCompletions(
  state: State,
  { position, textDocument }: CompletionParams
): CompletionList {
  let doc = state.editor.documents.get(textDocument.uri)

  if (!isCssContext(state, doc, position)) {
    return null
  }

  let text = doc.getText({
    start: { line: position.line, character: 0 },
    end: position,
  })

  const match = text.match(/^\s*@variants\s+(?<partial>[^}]*)$/i)

  if (match === null) return null

  const parts = match.groups.partial.split(/\s*,\s*/)

  if (/\s+/.test(parts[parts.length - 1])) return null

  const existingVariants = parts.slice(0, parts.length - 1)

  return {
    isIncomplete: false,
    items: state.variants
      .filter((v) => existingVariants.indexOf(v) === -1)
      .map((variant) => ({
        // TODO: detail
        label: variant,
        kind: CompletionItemKind.Constant,
        data: 'variant',
        textEdit: {
          newText: variant,
          range: {
            start: {
              line: position.line,
              character: position.character - parts[parts.length - 1].length,
            },
            end: position,
          },
        },
      })),
  }
}

function provideScreenDirectiveCompletions(
  state: State,
  { position, textDocument }: CompletionParams
): CompletionList {
  let doc = state.editor.documents.get(textDocument.uri)

  if (!isCssContext(state, doc, position)) {
    return null
  }

  let text = doc.getText({
    start: { line: position.line, character: 0 },
    end: position,
  })

  const match = text.match(/^\s*@screen\s+(?<partial>[^\s]*)$/i)

  if (match === null) return null

  const screens = dlv(
    state.config,
    ['screens'],
    dlv(state.config, ['theme', 'screens'], {})
  )

  if (!isObject(screens)) return null

  return {
    isIncomplete: false,
    items: Object.keys(screens).map((screen, index) => ({
      label: screen,
      kind: CompletionItemKind.Constant,
      data: 'screen',
      sortText: naturalExpand(index),
      textEdit: {
        newText: screen,
        range: {
          start: {
            line: position.line,
            character: position.character - match.groups.partial.length,
          },
          end: position,
        },
      },
    })),
  }
}

function provideCssDirectiveCompletions(
  state: State,
  { position, textDocument }: CompletionParams
): CompletionList {
  let doc = state.editor.documents.get(textDocument.uri)

  if (!isCssContext(state, doc, position)) {
    return null
  }

  let text = doc.getText({
    start: { line: position.line, character: 0 },
    end: position,
  })

  const match = text.match(/^\s*@(?<partial>[a-z]*)$/i)

  if (match === null) return null

  const items: CompletionItem[] = [
    {
      label: '@tailwind',
      documentation: {
        kind: MarkupKind.Markdown,
        value: `Use the \`@tailwind\` directive to insert Tailwind’s \`base\`, \`components\`, \`utilities\` and \`screens\` styles into your CSS.\n\n[Tailwind CSS Documentation](${docsUrl(
          state.version,
          'functions-and-directives/#tailwind'
        )})`,
      },
    },
    {
      label: '@variants',
      documentation: {
        kind: MarkupKind.Markdown,
        value: `You can generate \`responsive\`, \`hover\`, \`focus\`, \`active\`, and \`group-hover\` versions of your own utilities by wrapping their definitions in the \`@variants\` directive.\n\n[Tailwind CSS Documentation](${docsUrl(
          state.version,
          'functions-and-directives/#variants'
        )})`,
      },
    },
    {
      label: '@responsive',
      documentation: {
        kind: MarkupKind.Markdown,
        value: `You can generate responsive variants of your own classes by wrapping their definitions in the \`@responsive\` directive.\n\n[Tailwind CSS Documentation](${docsUrl(
          state.version,
          'functions-and-directives/#responsive'
        )})`,
      },
    },
    {
      label: '@screen',
      documentation: {
        kind: MarkupKind.Markdown,
        value: `The \`@screen\` directive allows you to create media queries that reference your breakpoints by name instead of duplicating their values in your own CSS.\n\n[Tailwind CSS Documentation](${docsUrl(
          state.version,
          'functions-and-directives/#screen'
        )})`,
      },
    },
    {
      label: '@apply',
      documentation: {
        kind: MarkupKind.Markdown,
        value: `Use \`@apply\` to inline any existing utility classes into your own custom CSS.\n\n[Tailwind CSS Documentation](${docsUrl(
          state.version,
          'functions-and-directives/#apply'
        )})`,
      },
    },
  ]

  return {
    isIncomplete: false,
    items: items.map((item) => ({
      ...item,
      kind: CompletionItemKind.Keyword,
      data: 'directive',
      textEdit: {
        newText: item.label,
        range: {
          start: {
            line: position.line,
            character: position.character - match.groups.partial.length - 1,
          },
          end: position,
        },
      },
    })),
  }
}

async function provideEmmetCompletions(
  state: State,
  { position, textDocument }: CompletionParams
): Promise<CompletionList> {
  let settings = await getDocumentSettings(state, textDocument.uri)
  if (settings.emmetCompletions !== true) return null

  let doc = state.editor.documents.get(textDocument.uri)

  const syntax = isHtmlContext(state, doc, position)
    ? 'html'
    : isJsContext(state, doc, position)
    ? 'jsx'
    : null

  if (syntax === null) {
    return null
  }

  const extractAbbreviationResults = emmetHelper.extractAbbreviation(
    doc,
    position,
    true
  )
  if (
    !extractAbbreviationResults ||
    !emmetHelper.isAbbreviationValid(
      syntax,
      extractAbbreviationResults.abbreviation
    )
  ) {
    return null
  }

  if (
    !isValidLocationForEmmetAbbreviation(
      doc,
      extractAbbreviationResults.abbreviationRange
    )
  ) {
    return null
  }

  const emmetItems = emmetHelper.doComplete(doc, position, syntax, {})

  if (!emmetItems || !emmetItems.items || emmetItems.items.length !== 1) {
    return null
  }

  // https://github.com/microsoft/vscode/issues/86941
  if (emmetItems.items[0].label === 'widows: ;') {
    return null
  }

  const parts = emmetItems.items[0].label.split('.')
  if (parts.length < 2) return null

  return completionsFromClassList(state, parts[parts.length - 1], {
    start: {
      line: position.line,
      character: position.character - parts[parts.length - 1].length,
    },
    end: position,
  })
}

export async function provideCompletions(
  state: State,
  params: CompletionParams
): Promise<CompletionList> {
  if (state === null) return { items: [], isIncomplete: false }

  const result =
    provideClassNameCompletions(state, params) ||
    provideCssHelperCompletions(state, params) ||
    provideCssDirectiveCompletions(state, params) ||
    provideScreenDirectiveCompletions(state, params) ||
    provideVariantsDirectiveCompletions(state, params) ||
    provideTailwindDirectiveCompletions(state, params)

  if (result) return result

  return provideEmmetCompletions(state, params)
}

export function resolveCompletionItem(
  state: State,
  item: CompletionItem
): CompletionItem {
  if (['helper', 'directive', 'variant', '@tailwind'].includes(item.data)) {
    return item
  }

  if (item.data === 'screen') {
    let screens = dlv(
      state.config,
      ['theme', 'screens'],
      dlv(state.config, ['screens'], {})
    )
    if (!isObject(screens)) screens = {}
    item.detail = stringifyScreen(screens[item.label] as Screen)
    return item
  }

  const className = dlv(state.classNames.classNames, item.data)
  if (isContextItem(state, item.data)) {
    item.detail = state.classNames.context[
      item.data[item.data.length - 1]
    ].join(', ')
  } else {
    item.detail = getCssDetail(state, className)
    if (!item.documentation) {
      const css = stringifyCss(item.data.join(':'), className)
      if (css) {
        item.documentation = {
          kind: MarkupKind.Markdown,
          value: ['```css', css, '```'].join('\n'),
        }
      }
    }
  }
  return item
}

function isContextItem(state: State, keys: string[]): boolean {
  const item = dlv(state.classNames.classNames, keys)
  return Boolean(
    isObject(item) &&
      !item.__rule &&
      !Array.isArray(item) &&
      state.classNames.context[keys[keys.length - 1]]
  )
}

function stringifyDecls(obj: any): string {
  let props = Object.keys(obj)
  let nonCustomProps = props.filter((prop) => !prop.startsWith('--'))

  if (props.length !== nonCustomProps.length && nonCustomProps.length !== 0) {
    props = nonCustomProps
  }

  return props
    .map((prop) =>
      ensureArray(obj[prop])
        .map((value) => `${prop}: ${value};`)
        .join(' ')
    )
    .join(' ')
}

function getCssDetail(state: State, className: any): string {
  if (Array.isArray(className)) {
    return `${className.length} rules`
  }
  if (className.__rule === true) {
    return stringifyDecls(removeMeta(className))
  }
  return null
}
