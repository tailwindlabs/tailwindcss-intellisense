import { State } from './util/state'
import type {
  CompletionItem,
  CompletionItemKind,
  Range,
  MarkupKind,
  CompletionList,
  TextDocument,
  Position,
  CompletionContext,
} from 'vscode-languageserver'
import dlv from 'dlv'
import removeMeta from './util/removeMeta'
import { getColor, getColorFromValue } from './util/color'
import { isHtmlContext } from './util/html'
import { isCssContext } from './util/css'
import { findLast, matchClassAttributes } from './util/find'
import { stringifyConfigValue, stringifyCss } from './util/stringify'
import { stringifyScreen, Screen } from './util/screens'
import isObject from './util/isObject'
import * as emmetHelper from 'vscode-emmet-helper-bundled'
import { isValidLocationForEmmetAbbreviation } from './util/isValidLocationForEmmetAbbreviation'
import { isJsDoc, isJsxContext } from './util/js'
import { naturalExpand } from './util/naturalExpand'
import semver from 'semver'
import { docsUrl } from './util/docsUrl'
import { ensureArray } from './util/array'
import { getClassAttributeLexer, getComputedClassAttributeLexer } from './util/lexers'
import { validateApply } from './util/validateApply'
import { flagEnabled } from './util/flagEnabled'
import { remToPx } from './util/remToPx'
import { createMultiRegexp } from './util/createMultiRegexp'
import * as jit from './util/jit'
import { getVariantsFromClassName } from './util/getVariantsFromClassName'
import * as culori from 'culori'

let isUtil = (className) =>
  Array.isArray(className.__info)
    ? className.__info.some((x) => x.__source === 'utilities')
    : className.__info.__source === 'utilities'

export function completionsFromClassList(
  state: State,
  classList: string,
  classListRange: Range,
  filter?: (item: CompletionItem) => boolean,
  document?: TextDocument,
  context?: CompletionContext
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

  if (state.jit) {
    if (
      context &&
      (context.triggerKind === 1 ||
        (context.triggerKind === 2 && context.triggerCharacter === '/')) &&
      partialClassName.includes('/')
    ) {
      // opacity modifiers
      let beforeSlash = partialClassName.split('/').slice(0, -1).join('/')
      let testClass = beforeSlash + '/[0]'
      let { rules } = jit.generateRules(state, [testClass])
      if (rules.length > 0) {
        let opacities = dlv(state.config, 'theme.opacity', {})
        if (!isObject(opacities)) {
          opacities = {}
        }
        return {
          isIncomplete: false,
          items: Object.keys(opacities).map((opacity, index) => {
            let className = `${beforeSlash}/${opacity}`
            let kind: CompletionItemKind = 21
            let documentation: string = null

            const color = getColor(state, className)
            if (color !== null) {
              kind = 16
              if (typeof color !== 'string' && (color.alpha ?? 1) !== 0) {
                documentation = culori.formatRgb(color)
              }
            }

            return {
              label: className,
              documentation,
              kind,
              sortText: naturalExpand(index),
              data: [className],
              textEdit: {
                newText: className,
                range: replacementRange,
              },
            }
          }),
        }
      }
    }

    let allVariants = Object.keys(state.variants)
    let { variants: existingVariants, offset } = getVariantsFromClassName(state, partialClassName)

    replacementRange.start.character += offset

    let important = partialClassName.substr(offset).startsWith('!')
    if (important) {
      replacementRange.start.character += 1
    }

    let items: CompletionItem[] = []

    if (!important) {
      let shouldSortVariants = !semver.gte(state.version, '2.99.0')

      items.push(
        ...Object.entries(state.variants)
          .filter(([variant]) => !existingVariants.includes(variant))
          .map(([variant, definition], index) => {
            let resultingVariants = [...existingVariants, variant]

            if (shouldSortVariants) {
              resultingVariants = resultingVariants.sort(
                (a, b) => allVariants.indexOf(b) - allVariants.indexOf(a)
              )
            }

            return {
              label: variant + sep,
              kind: 9,
              detail: definition,
              data: 'variant',
              command: {
                title: '',
                command: 'editor.action.triggerSuggest',
              },
              sortText: '-' + naturalExpand(index),
              textEdit: {
                newText: resultingVariants[resultingVariants.length - 1] + sep,
                range: replacementRange,
              },
              additionalTextEdits:
                shouldSortVariants && resultingVariants.length > 1
                  ? [
                      {
                        newText:
                          resultingVariants.slice(0, resultingVariants.length - 1).join(sep) + sep,
                        range: {
                          start: {
                            ...classListRange.start,
                            character: classListRange.end.character - partialClassName.length,
                          },
                          end: {
                            ...replacementRange.start,
                            character: replacementRange.start.character,
                          },
                        },
                      },
                    ]
                  : [],
            } as CompletionItem
          })
      )
    }

    if (state.classList) {
      return {
        isIncomplete: false,
        items: items.concat(
          state.classList.map(([className, { color }], index) => {
            let kind: CompletionItemKind = color ? 16 : 21
            let documentation = null

            if (color && typeof color !== 'string') {
              documentation = culori.formatRgb(color)
            }

            return {
              label: className,
              kind,
              documentation,
              sortText: naturalExpand(index),
              data: [...existingVariants, important ? `!${className}` : className],
              textEdit: {
                newText: className,
                range: replacementRange,
              },
            } as CompletionItem
          })
        ),
      }
    }

    return {
      isIncomplete: false,
      items: items
        .concat(
          Object.keys(state.classNames.classNames)
            .filter((className) => {
              let item = state.classNames.classNames[className]
              if (existingVariants.length === 0) {
                return item.__info
              }
              return item.__info && isUtil(item)
            })
            .map((className, index) => {
              let kind: CompletionItemKind = 21
              let documentation: string = null

              const color = getColor(state, className)
              if (color !== null) {
                kind = 16
                if (typeof color !== 'string' && (color.alpha ?? 1) !== 0) {
                  documentation = culori.formatRgb(color)
                }
              }

              return {
                label: className,
                kind,
                documentation,
                sortText: naturalExpand(index),
                data: [...existingVariants, important ? `!${className}` : className],
                textEdit: {
                  newText: className,
                  range: replacementRange,
                },
              } as CompletionItem
            })
        )
        .filter((item) => {
          if (item === null) {
            return false
          }
          if (filter && !filter(item)) {
            return false
          }
          return true
        }),
    }
  }

  for (let i = parts.length - 1; i > 0; i--) {
    let keys = parts.slice(0, i).filter(Boolean)
    subset = dlv(state.classNames.classNames, keys)
    if (typeof subset !== 'undefined' && typeof dlv(subset, ['__info', '__rule']) === 'undefined') {
      isSubset = true
      subsetKey = keys
      replacementRange = {
        ...replacementRange,
        start: {
          ...replacementRange.start,
          character: replacementRange.start.character + keys.join(sep).length + sep.length,
        },
      }
      break
    }
  }

  return {
    isIncomplete: false,
    items: Object.keys(isSubset ? subset : state.classNames.classNames)
      .filter((k) => k !== '__info')
      .filter((className) => isContextItem(state, [...subsetKey, className]))
      .map((className, index): CompletionItem => {
        return {
          label: className + sep,
          kind: 9,
          documentation: null,
          command: {
            title: '',
            command: 'editor.action.triggerSuggest',
          },
          sortText: '-' + naturalExpand(index),
          data: [...subsetKey, className],
          textEdit: {
            newText: className + sep,
            range: replacementRange,
          },
        }
      })
      .concat(
        Object.keys(isSubset ? subset : state.classNames.classNames)
          .filter((className) =>
            dlv(state.classNames.classNames, [...subsetKey, className, '__info'])
          )
          .map((className, index) => {
            let kind: CompletionItemKind = 21
            let documentation: string = null

            const color = getColor(state, className)
            if (color !== null) {
              kind = 16
              if (typeof color !== 'string' && (color.alpha ?? 1) !== 0) {
                documentation = culori.formatRgb(color)
              }
            }

            return {
              label: className,
              kind,
              documentation,
              sortText: naturalExpand(index),
              data: [...subsetKey, className],
              textEdit: {
                newText: className,
                range: replacementRange,
              },
            }
          })
      )
      .filter((item) => {
        if (item === null) {
          return false
        }
        if (filter && !filter(item)) {
          return false
        }
        return true
      }),
  }
}

async function provideClassAttributeCompletions(
  state: State,
  document: TextDocument,
  position: Position,
  context?: CompletionContext
): Promise<CompletionList> {
  let str = document.getText({
    start: document.positionAt(Math.max(0, document.offsetAt(position) - 1000)),
    end: position,
  })

  let matches = matchClassAttributes(
    str,
    (await state.editor.getConfiguration(document.uri)).tailwindCSS.classAttributes
  )

  if (matches.length === 0) {
    return null
  }

  let match = matches[matches.length - 1]

  const lexer =
    match[0][0] === ':' || (match[1].startsWith('[') && match[1].endsWith(']'))
      ? getComputedClassAttributeLexer()
      : getClassAttributeLexer()
  lexer.reset(str.substr(match.index + match[0].length - 1))

  try {
    let tokens = Array.from(lexer)
    let last = tokens[tokens.length - 1]
    if (last.type.startsWith('start') || last.type === 'classlist') {
      let classList = ''
      for (let i = tokens.length - 1; i >= 0; i--) {
        if (tokens[i].type === 'classlist') {
          classList = tokens[i].value + classList
        } else {
          break
        }
      }

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
        undefined,
        document,
        context
      )
    }
  } catch (_) {}

  return null
}

async function provideCustomClassNameCompletions(
  state: State,
  document: TextDocument,
  position: Position
): Promise<CompletionList> {
  const settings = await state.editor.getConfiguration(document.uri)
  const regexes = dlv(settings, 'tailwindCSS.experimental.classRegex', [])
  if (regexes.length === 0) return null

  const positionOffset = document.offsetAt(position)

  const searchRange: Range = {
    start: document.positionAt(Math.max(0, positionOffset - 1000)),
    end: document.positionAt(positionOffset + 1000),
  }

  let str = document.getText(searchRange)

  for (let i = 0; i < regexes.length; i++) {
    try {
      let [containerRegex, classRegex] = Array.isArray(regexes[i]) ? regexes[i] : [regexes[i]]

      containerRegex = createMultiRegexp(containerRegex)
      let containerMatch

      while ((containerMatch = containerRegex.exec(str)) !== null) {
        const searchStart = document.offsetAt(searchRange.start)
        const matchStart = searchStart + containerMatch.start
        const matchEnd = searchStart + containerMatch.end
        const cursor = document.offsetAt(position)
        if (cursor >= matchStart && cursor <= matchEnd) {
          let classList

          if (classRegex) {
            classRegex = createMultiRegexp(classRegex)
            let classMatch

            while ((classMatch = classRegex.exec(containerMatch.match)) !== null) {
              const classMatchStart = matchStart + classMatch.start
              const classMatchEnd = matchStart + classMatch.end
              if (cursor >= classMatchStart && cursor <= classMatchEnd) {
                classList = classMatch.match.substr(0, cursor - classMatchStart)
              }
            }

            if (typeof classList === 'undefined') {
              throw Error()
            }
          } else {
            classList = containerMatch.match.substr(0, cursor - matchStart)
          }

          return completionsFromClassList(state, classList, {
            start: {
              line: position.line,
              character: position.character - classList.length,
            },
            end: position,
          })
        }
      }
    } catch (_) {}
  }

  return null
}

function provideAtApplyCompletions(
  state: State,
  document: TextDocument,
  position: Position
): CompletionList {
  let str = document.getText({
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
      if (item.kind === 9) {
        return (
          semver.gte(state.version, '2.0.0-alpha.1') || flagEnabled(state, 'applyComplexClasses')
        )
      }
      let validated = validateApply(state, item.data)
      return validated !== null && validated.isApplyable === true
    }
  )
}

async function provideClassNameCompletions(
  state: State,
  document: TextDocument,
  position: Position,
  context?: CompletionContext
): Promise<CompletionList> {
  if (isCssContext(state, document, position)) {
    return provideAtApplyCompletions(state, document, position)
  }

  if (isHtmlContext(state, document, position) || isJsxContext(state, document, position)) {
    return provideClassAttributeCompletions(state, document, position, context)
  }

  return null
}

function provideCssHelperCompletions(
  state: State,
  document: TextDocument,
  position: Position
): CompletionList {
  if (!isCssContext(state, document, position)) {
    return null
  }

  let text = document.getText({
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

  let base = match.groups.helper === 'config' ? state.config : dlv(state.config, 'theme', {})
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
  let separator: string = separators.length ? separators[separators.length - 1] : null

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
      const replaceDot: boolean = item.indexOf('.') !== -1 && separator && separator.endsWith('.')
      const insertClosingBrace: boolean =
        text.charAt(text.length - 1) !== ']' &&
        (replaceDot || (separator && separator.endsWith('[')))
      const detail = stringifyConfigValue(obj[item])

      return {
        label: item,
        filterText: `${replaceDot ? '.' : ''}${item}`,
        sortText: naturalExpand(index),
        kind: color ? 16 : isObject(obj[item]) ? 9 : 10,
        // VS Code bug causes some values to not display in some cases
        detail: detail === '0' || detail === 'transparent' ? `${detail} ` : detail,
        documentation:
          color && typeof color !== 'string' && (color.alpha ?? 1) !== 0
            ? culori.formatRgb(color)
            : null,
        textEdit: {
          newText: `${replaceDot ? '[' : ''}${item}${insertClosingBrace ? ']' : ''}`,
          range: {
            start: {
              line: position.line,
              character:
                position.character - keys[keys.length - 1].length - (replaceDot ? 1 : 0) - offset,
            },
            end: position,
          },
        },
        data: 'helper',
      }
    }),
  }
}

function provideTailwindDirectiveCompletions(
  state: State,
  document: TextDocument,
  position: Position
): CompletionList {
  if (!isCssContext(state, document, position)) {
    return null
  }

  let text = document.getText({
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
              kind: 'markdown' as typeof MarkupKind.Markdown,
              value: `This injects Tailwind’s base styles and any base styles registered by plugins.\n\n[Tailwind CSS Documentation](${docsUrl(
                state.version,
                'functions-and-directives/#tailwind'
              )})`,
            },
          }
        : {
            label: 'preflight',
            documentation: {
              kind: 'markdown' as typeof MarkupKind.Markdown,
              value: `This injects Tailwind’s base styles, which is a combination of Normalize.css and some additional base styles.\n\n[Tailwind CSS Documentation](${docsUrl(
                state.version,
                'functions-and-directives/#tailwind'
              )})`,
            },
          },
      {
        label: 'components',
        documentation: {
          kind: 'markdown' as typeof MarkupKind.Markdown,
          value: `This injects Tailwind’s component classes and any component classes registered by plugins.\n\n[Tailwind CSS Documentation](${docsUrl(
            state.version,
            'functions-and-directives/#tailwind'
          )})`,
        },
      },
      {
        label: 'utilities',
        documentation: {
          kind: 'markdown' as typeof MarkupKind.Markdown,
          value: `This injects Tailwind’s utility classes and any utility classes registered by plugins.\n\n[Tailwind CSS Documentation](${docsUrl(
            state.version,
            'functions-and-directives/#tailwind'
          )})`,
        },
      },
      state.jit && semver.gte(state.version, '2.1.99')
        ? {
            label: 'variants',
            documentation: {
              kind: 'markdown' as typeof MarkupKind.Markdown,
              value: `Use this directive to control where Tailwind injects the utility variants.\n\nThis directive is considered an advanced escape hatch and it is recommended to omit it whenever possible. If omitted, Tailwind will append these classes to the very end of your stylesheet by default.\n\n[Tailwind CSS Documentation](${docsUrl(
                state.version,
                'just-in-time-mode#variants-are-inserted-at-tailwind-variants'
              )})`,
            },
          }
        : {
            label: 'screens',
            documentation: {
              kind: 'markdown' as typeof MarkupKind.Markdown,
              value: `Use this directive to control where Tailwind injects the responsive variations of each utility.\n\nIf omitted, Tailwind will append these classes to the very end of your stylesheet by default.\n\n[Tailwind CSS Documentation](${docsUrl(
                state.version,
                'functions-and-directives/#tailwind'
              )})`,
            },
          },
    ].map((item) => ({
      ...item,
      kind: 21,
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
  document: TextDocument,
  position: Position
): CompletionList {
  if (!isCssContext(state, document, position)) {
    return null
  }

  if (semver.gte(state.version, '2.99.0')) {
    return null
  }

  let text = document.getText({
    start: { line: position.line, character: 0 },
    end: position,
  })

  const match = text.match(/^\s*@variants\s+(?<partial>[^}]*)$/i)

  if (match === null) return null

  const parts = match.groups.partial.split(/\s*,\s*/)

  if (/\s+/.test(parts[parts.length - 1])) return null

  let possibleVariants = Object.keys(state.variants)
  const existingVariants = parts.slice(0, parts.length - 1)

  if (state.jit) {
    possibleVariants.unshift('responsive')
    possibleVariants = possibleVariants.filter((v) => !state.screens.includes(v))
  }

  return {
    isIncomplete: false,
    items: possibleVariants
      .filter((v) => existingVariants.indexOf(v) === -1)
      .map((variant, index) => ({
        // TODO: detail
        label: variant,
        detail: state.variants[variant],
        kind: 21,
        data: 'variant',
        sortText: naturalExpand(index),
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

function provideLayerDirectiveCompletions(
  state: State,
  document: TextDocument,
  position: Position
): CompletionList {
  if (!isCssContext(state, document, position)) {
    return null
  }

  let text = document.getText({
    start: { line: position.line, character: 0 },
    end: position,
  })

  const match = text.match(/^\s*@layer\s+(?<partial>[^\s]*)$/i)

  if (match === null) return null

  return {
    isIncomplete: false,
    items: ['base', 'components', 'utilities'].map((layer, index) => ({
      label: layer,
      kind: 21,
      data: 'layer',
      sortText: naturalExpand(index),
      textEdit: {
        newText: layer,
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

function provideScreenDirectiveCompletions(
  state: State,
  document: TextDocument,
  position: Position
): CompletionList {
  if (!isCssContext(state, document, position)) {
    return null
  }

  let text = document.getText({
    start: { line: position.line, character: 0 },
    end: position,
  })

  const match = text.match(/^\s*@screen\s+(?<partial>[^\s]*)$/i)

  if (match === null) return null

  const screens = dlv(state.config, ['screens'], dlv(state.config, ['theme', 'screens'], {}))

  if (!isObject(screens)) return null

  return {
    isIncomplete: false,
    items: Object.keys(screens).map((screen, index) => ({
      label: screen,
      kind: 21,
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
  document: TextDocument,
  position: Position
): CompletionList {
  if (!isCssContext(state, document, position)) {
    return null
  }

  let text = document.getText({
    start: { line: position.line, character: 0 },
    end: position,
  })

  const match = text.match(/^\s*@(?<partial>[a-z]*)$/i)

  if (match === null) return null

  const items: CompletionItem[] = [
    {
      label: '@tailwind',
      documentation: {
        kind: 'markdown' as typeof MarkupKind.Markdown,
        value: `Use the \`@tailwind\` directive to insert Tailwind’s \`base\`, \`components\`, \`utilities\` and \`${
          state.jit && semver.gte(state.version, '2.1.99') ? 'variants' : 'screens'
        }\` styles into your CSS.\n\n[Tailwind CSS Documentation](${docsUrl(
          state.version,
          'functions-and-directives/#tailwind'
        )})`,
      },
    },
    {
      label: '@screen',
      documentation: {
        kind: 'markdown' as typeof MarkupKind.Markdown,
        value: `The \`@screen\` directive allows you to create media queries that reference your breakpoints by name instead of duplicating their values in your own CSS.\n\n[Tailwind CSS Documentation](${docsUrl(
          state.version,
          'functions-and-directives/#screen'
        )})`,
      },
    },
    {
      label: '@apply',
      documentation: {
        kind: 'markdown' as typeof MarkupKind.Markdown,
        value: `Use \`@apply\` to inline any existing utility classes into your own custom CSS.\n\n[Tailwind CSS Documentation](${docsUrl(
          state.version,
          'functions-and-directives/#apply'
        )})`,
      },
    },
    ...(semver.gte(state.version, '1.8.0')
      ? [
          {
            label: '@layer',
            documentation: {
              kind: 'markdown' as typeof MarkupKind.Markdown,
              value: `Use the \`@layer\` directive to tell Tailwind which "bucket" a set of custom styles belong to. Valid layers are \`base\`, \`components\`, and \`utilities\`.\n\n[Tailwind CSS Documentation](${docsUrl(
                state.version,
                'functions-and-directives/#layer'
              )})`,
            },
          },
        ]
      : []),
    ...(semver.gte(state.version, '2.99.0')
      ? []
      : [
          {
            label: '@variants',
            documentation: {
              kind: 'markdown' as typeof MarkupKind.Markdown,
              value: `You can generate \`responsive\`, \`hover\`, \`focus\`, \`active\`, and other variants of your own utilities by wrapping their definitions in the \`@variants\` directive.\n\n[Tailwind CSS Documentation](${docsUrl(
                state.version,
                'functions-and-directives/#variants'
              )})`,
            },
          },
          {
            label: '@responsive',
            documentation: {
              kind: 'markdown' as typeof MarkupKind.Markdown,
              value: `You can generate responsive variants of your own classes by wrapping their definitions in the \`@responsive\` directive.\n\n[Tailwind CSS Documentation](${docsUrl(
                state.version,
                'functions-and-directives/#responsive'
              )})`,
            },
          },
        ]),
  ]

  return {
    isIncomplete: false,
    items: items.map((item) => ({
      ...item,
      kind: 14,
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
  document: TextDocument,
  position: Position
): Promise<CompletionList> {
  let settings = await state.editor.getConfiguration(document.uri)
  if (settings.tailwindCSS.emmetCompletions !== true) return null

  const isHtml = !isJsDoc(state, document) && isHtmlContext(state, document, position)
  const isJs = isJsDoc(state, document) || isJsxContext(state, document, position)

  const syntax = isHtml ? 'html' : isJs ? 'jsx' : null

  if (syntax === null) {
    return null
  }

  const extractAbbreviationResults = emmetHelper.extractAbbreviation(document, position, true)
  if (
    !extractAbbreviationResults ||
    !emmetHelper.isAbbreviationValid(syntax, extractAbbreviationResults.abbreviation)
  ) {
    return null
  }

  if (
    !isValidLocationForEmmetAbbreviation(document, extractAbbreviationResults.abbreviationRange)
  ) {
    return null
  }

  if (isJs) {
    const abbreviation: string = extractAbbreviationResults.abbreviation
    if (abbreviation.startsWith('this.')) {
      return null
    }
    const symbols = await state.editor.getDocumentSymbols(document.uri)
    if (
      symbols &&
      symbols.find(
        (symbol) =>
          abbreviation === symbol.name ||
          (abbreviation.startsWith(symbol.name + '.') && !/>|\*|\+/.test(abbreviation))
      )
    ) {
      return null
    }
  }

  const emmetItems = emmetHelper.doComplete(document, position, syntax, {})

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

export async function doComplete(
  state: State,
  document: TextDocument,
  position: Position,
  context?: CompletionContext
) {
  if (state === null) return { items: [], isIncomplete: false }

  const result =
    (await provideClassNameCompletions(state, document, position, context)) ||
    provideCssHelperCompletions(state, document, position) ||
    provideCssDirectiveCompletions(state, document, position) ||
    provideScreenDirectiveCompletions(state, document, position) ||
    provideVariantsDirectiveCompletions(state, document, position) ||
    provideTailwindDirectiveCompletions(state, document, position) ||
    provideLayerDirectiveCompletions(state, document, position) ||
    (await provideCustomClassNameCompletions(state, document, position))

  if (result) return result

  return provideEmmetCompletions(state, document, position)
}

export async function resolveCompletionItem(
  state: State,
  item: CompletionItem
): Promise<CompletionItem> {
  if (['helper', 'directive', 'variant', 'layer', '@tailwind'].includes(item.data)) {
    return item
  }

  if (item.data === 'screen') {
    let screens = dlv(state.config, ['theme', 'screens'], dlv(state.config, ['screens'], {}))
    if (!isObject(screens)) screens = {}
    item.detail = stringifyScreen(screens[item.label] as Screen)
    return item
  }

  if (!Array.isArray(item.data)) {
    return item
  }

  if (state.jit) {
    if (item.kind === 9) return item
    if (item.detail && item.documentation) return item
    let { root, rules } = jit.generateRules(state, [item.data.join(state.separator)])
    if (rules.length === 0) return item
    if (!item.detail) {
      if (rules.length === 1) {
        item.detail = await jit.stringifyDecls(state, rules[0])
      } else {
        item.detail = `${rules.length} rules`
      }
    }
    if (!item.documentation) {
      item.documentation = {
        kind: 'markdown' as typeof MarkupKind.Markdown,
        value: ['```css', await jit.stringifyRoot(state, root), '```'].join('\n'),
      }
    }
    return item
  }

  const className = dlv(state.classNames.classNames, [...item.data, '__info'])
  if (item.kind === 9) {
    item.detail = state.classNames.context[item.data[item.data.length - 1]].join(', ')
  } else {
    item.detail = await getCssDetail(state, className)
    if (!item.documentation) {
      const settings = await state.editor.getConfiguration()
      const css = stringifyCss(item.data.join(':'), className, {
        tabSize: dlv(settings, 'editor.tabSize', 2),
        showPixelEquivalents: dlv(settings, 'tailwindCSS.showPixelEquivalents', true),
        rootFontSize: dlv(settings, 'tailwindCSS.rootFontSize', 16),
      })
      if (css) {
        item.documentation = {
          kind: 'markdown' as typeof MarkupKind.Markdown,
          value: ['```css', css, '```'].join('\n'),
        }
      }
    }
  }
  return item
}

function isContextItem(state: State, keys: string[]): boolean {
  const item = dlv(state.classNames.classNames, [keys])

  if (!isObject(item)) {
    return false
  }
  if (!state.classNames.context[keys[keys.length - 1]]) {
    return false
  }
  if (Object.keys(item).filter((x) => x !== '__info').length > 0) {
    return true
  }

  return isObject(item.__info) && !item.__info.__rule
}

function stringifyDecls(
  obj: any,
  {
    showPixelEquivalents = false,
    rootFontSize = 16,
  }: Partial<{ showPixelEquivalents: boolean; rootFontSize: number }> = {}
): string {
  let props = Object.keys(obj)
  let nonCustomProps = props.filter((prop) => !prop.startsWith('--'))

  if (props.length !== nonCustomProps.length && nonCustomProps.length !== 0) {
    props = nonCustomProps
  }

  return props
    .map((prop) =>
      ensureArray(obj[prop])
        .map((value) => {
          const px = showPixelEquivalents ? remToPx(value, rootFontSize) : undefined
          return `${prop}: ${value}${px ? `/* ${px} */` : ''};`
        })
        .join(' ')
    )
    .join(' ')
}

async function getCssDetail(state: State, className: any): Promise<string> {
  if (Array.isArray(className)) {
    return `${className.length} rules`
  }
  if (className.__rule === true) {
    const settings = await state.editor.getConfiguration()
    return stringifyDecls(removeMeta(className), {
      showPixelEquivalents: dlv(settings, 'tailwindCSS.showPixelEquivalents', true),
      rootFontSize: dlv(settings, 'tailwindCSS.rootFontSize', 16),
    })
  }
  return null
}
