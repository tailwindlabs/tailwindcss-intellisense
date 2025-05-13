import { Settings, State } from './util/state'
import {
  type CompletionItem,
  CompletionItemKind,
  type Range,
  type MarkupKind,
  type CompletionList,
  type Position,
  type CompletionContext,
  InsertTextFormat,
} from 'vscode-languageserver'
import type { TextDocument } from 'vscode-languageserver-textdocument'
import dlv from 'dlv'
import removeMeta from './util/removeMeta'
import { formatColor, getColor, getColorFromValue } from './util/color'
import { isHtmlContext, isHtmlDoc, isVueDoc } from './util/html'
import { isCssContext } from './util/css'
import { findLast, matchClassAttributes, matchClassFunctions } from './util/find'
import { stringifyConfigValue, stringifyCss } from './util/stringify'
import { stringifyScreen, Screen } from './util/screens'
import isObject from './util/isObject'
import { braceLevel, parenLevel } from './util/braceLevel'
import * as emmetHelper from 'vscode-emmet-helper-bundled'
import { isValidLocationForEmmetAbbreviation } from './util/isValidLocationForEmmetAbbreviation'
import { isJsContext, isJsDoc, isJsxContext } from './util/js'
import { naturalExpand } from './util/naturalExpand'
import * as semver from './util/semver'
import { getTextWithoutComments } from './util/doc'
import { docsUrl } from './util/docsUrl'
import { ensureArray } from './util/array'
import { getClassAttributeLexer, getComputedClassAttributeLexer } from './util/lexers'
import { validateApply } from './util/validateApply'
import { flagEnabled } from './util/flagEnabled'
import * as jit from './util/jit'
import { getVariantsFromClassName } from './util/getVariantsFromClassName'
import {
  addPixelEquivalentsToMediaQuery,
  addPixelEquivalentsToValue,
} from './util/pixelEquivalents'
import { customClassesIn } from './util/classes'
import { IS_SCRIPT_SOURCE, IS_TEMPLATE_SOURCE } from './metadata/extensions'
import * as postcss from 'postcss'
import { findFileDirective } from './completions/file-paths'
import type { ThemeEntry } from './util/v4'
import { segment } from './util/segment'
import { resolveKnownThemeKeys, resolveKnownThemeNamespaces } from './util/v4/theme-keys'
import { SEARCH_RANGE } from './util/constants'
import { getLanguageBoundaries } from './util/getLanguageBoundaries'
import { isWithinRange } from './util/isWithinRange'

let isUtil = (className) =>
  Array.isArray(className.__info)
    ? className.__info.some((x) => x.__source === 'utilities')
    : className.__info.__source === 'utilities'

export function completionsFromClassList(
  state: State,
  classList: string,
  classListRange: Range,
  rootFontSize: number,
  filter?: (item: CompletionItem) => boolean,
  context?: CompletionContext,
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

  if (state.v4) {
    let prefix = state.designSystem.theme.prefix ?? ''

    let { variants: existingVariants, offset } = getVariantsFromClassName(state, partialClassName)

    if (
      context &&
      (context.triggerKind === 1 ||
        (context.triggerKind === 2 && context.triggerCharacter === '/')) &&
      partialClassName.includes('/')
    ) {
      // modifiers
      let modifiers: string[]
      let beforeSlash = partialClassName.split('/').slice(0, -1).join('/')

      let baseClassName = beforeSlash.slice(offset)
      modifiers =
        state.classList.find((cls) => Array.isArray(cls) && cls[0] === baseClassName)?.[1]
          ?.modifiers ?? []

      if (modifiers.length > 0) {
        return withDefaults(
          {
            isIncomplete: false,
            items: modifiers.map((modifier, index) => {
              let className = `${beforeSlash}/${modifier}`
              let kind: CompletionItemKind = CompletionItemKind.Constant
              let documentation: string | undefined

              const color = getColor(state, className)
              if (color !== null) {
                kind = CompletionItemKind.Color
                if (typeof color !== 'string' && (color.alpha ?? 1) !== 0) {
                  documentation = formatColor(color)
                }
              }

              return {
                label: className,
                ...(documentation ? { documentation } : {}),
                kind,
                sortText: naturalExpand(index),
              }
            }),
          },
          {
            range: replacementRange,
            data: state.completionItemData,
          },
          state.editor.capabilities.itemDefaults,
        )
      }
    }

    replacementRange.start.character += offset

    let important = partialClassName.substr(offset).endsWith('!')
    if (important) {
      replacementRange.end.character -= 1
    }

    let items: CompletionItem[] = []
    let seenVariants = new Set<string>()

    let variantOrder = 0

    function variantItem(
      item: Omit<CompletionItem, 'kind' | 'data' | 'command' | 'sortText' | 'textEdit'>,
    ): CompletionItem {
      return {
        kind: 9,
        data: {
          ...(state.completionItemData ?? {}),
          _type: 'variant',
        },
        command:
          item.insertTextFormat === 2 // Snippet
            ? undefined
            : {
                title: '',
                command: 'editor.action.triggerSuggest',
              },
        sortText: '-' + naturalExpand(variantOrder++),
        ...item,
      }
    }

    for (let variant of state.variants) {
      if (existingVariants.includes(variant.name)) {
        continue
      }

      if (seenVariants.has(variant.name)) {
        continue
      }

      seenVariants.add(variant.name)

      if (variant.isArbitrary) {
        items.push(
          variantItem({
            label: `${variant.name}${variant.hasDash ? '-' : ''}[]${sep}`,
            insertTextFormat: 2,
            textEditText: `${variant.name}${variant.hasDash ? '-' : ''}[\${1}]${sep}\${0}`,
            // command: {
            //   title: '',
            //   command: 'tailwindCSS.onInsertArbitraryVariantSnippet',
            //   arguments: [variant.name, replacementRange],
            // },
          }),
        )
      } else {
        let resultingVariants = [...existingVariants, variant.name]

        let selectors: string[] = []

        try {
          selectors = variant.selectors()
        } catch (err) {
          // If the selectors function fails we don't want to crash the whole completion process
          console.log('Error while trying to get selectors for variant')
          console.log({
            variant,
            err,
          })

          continue
        }

        items.push(
          variantItem({
            label: `${variant.name}${sep}`,
            detail: selectors
              .map((selector) => addPixelEquivalentsToMediaQuery(selector))
              .join(', '),
            textEditText: resultingVariants[resultingVariants.length - 1] + sep,
          }),
        )
      }

      for (let value of variant.values ?? []) {
        if (existingVariants.includes(`${variant.name}-${value}`)) {
          continue
        }

        if (seenVariants.has(`${variant.name}-${value}`)) {
          continue
        }

        seenVariants.add(`${variant.name}-${value}`)

        let selectors: string[] = []

        try {
          selectors = variant.selectors({ value })
        } catch (err) {
          // If the selectors function fails we don't want to crash the whole completion process
          console.log('Error while trying to get selectors for variant')
          console.log({
            variant,
            err,
          })
        }

        if (selectors.length === 0) {
          continue
        }

        items.push(
          variantItem({
            label:
              value === 'DEFAULT'
                ? `${variant.name}${sep}`
                : `${variant.name}${variant.hasDash ? '-' : ''}${value}${sep}`,
            detail: selectors.join(', '),
          }),
        )
      }
    }

    // TODO: This is a bit of a hack
    if (prefix.length > 0) {
      // No variants seen:
      // - suggest the prefix as a variant
      // - Modify the remaining items to include the prefix in the variant name
      if (existingVariants.length === 0) {
        items = items.map((item, idx) => {
          if (idx === 0) return item

          item.label = `${prefix}:${item.label}`

          if (item.textEditText) {
            item.textEditText = `${prefix}:${item.textEditText}`
          }

          return item
        })
      }

      // The first variant is not the prefix: don't suggest anything
      if (existingVariants.length > 0 && existingVariants[0] !== prefix) {
        return null
      }
    }

    return withDefaults(
      {
        isIncomplete: false,
        items: items.concat(
          state.classList.reduce<CompletionItem[]>((items, [className, { color }], index) => {
            if (state.blocklist?.includes([...existingVariants, className].join(state.separator))) {
              return items
            }

            let kind = color ? CompletionItemKind.Color : CompletionItemKind.Constant
            let documentation: string | undefined

            if (color && typeof color !== 'string') {
              documentation = formatColor(color)
            }

            if (prefix.length > 0 && existingVariants.length === 0) {
              className = `${prefix}:${className}`
            }

            items.push({
              label: className,
              kind,
              ...(documentation ? { documentation } : {}),
              sortText: naturalExpand(index, state.classList.length),
            })

            return items
          }, [] as CompletionItem[]),
        ),
      },
      {
        data: {
          ...(state.completionItemData ?? {}),
          ...(important ? { important } : {}),
          variants: existingVariants,
        },
        range: replacementRange,
      },
      state.editor.capabilities.itemDefaults,
    )
  }

  if (state.jit) {
    let { variants: existingVariants, offset } = getVariantsFromClassName(state, partialClassName)

    if (
      context &&
      (context.triggerKind === 1 ||
        (context.triggerKind === 2 && context.triggerCharacter === '/')) &&
      partialClassName.includes('/')
    ) {
      // modifiers
      let modifiers: string[]
      let beforeSlash = partialClassName.split('/').slice(0, -1).join('/')

      if (state.classListContainsMetadata) {
        let baseClassName = beforeSlash.slice(offset)
        modifiers = state.classList.find(
          (cls) => Array.isArray(cls) && cls[0] === baseClassName,
        )?.[1]?.modifiers
      } else {
        let testClass = beforeSlash + '/[0]'
        let { rules } = jit.generateRules(state, [testClass])
        if (rules.length > 0) {
          let opacities = dlv(state.config, 'theme.opacity', {})
          if (!isObject(opacities)) {
            opacities = {}
          }
          modifiers = Object.keys(opacities)
        }
      }

      if (modifiers) {
        return withDefaults(
          {
            isIncomplete: false,
            items: modifiers.map((modifier, index) => {
              let className = `${beforeSlash}/${modifier}`
              let kind: CompletionItemKind = CompletionItemKind.Constant
              let documentation: string | undefined

              const color = getColor(state, className)
              if (color !== null) {
                kind = CompletionItemKind.Color
                if (typeof color !== 'string' && (color.alpha ?? 1) !== 0) {
                  documentation = formatColor(color)
                }
              }

              return {
                label: className,
                ...(documentation ? { documentation } : {}),
                kind,
                sortText: naturalExpand(index),
              }
            }),
          },
          {
            range: replacementRange,
            data: state.completionItemData,
          },
          state.editor.capabilities.itemDefaults,
        )
      }
    }

    replacementRange.start.character += offset

    let important = partialClassName.substr(offset).startsWith('!')
    if (important) {
      replacementRange.start.character += 1
    }

    let items: CompletionItem[] = []
    let seenVariants = new Set<string>()

    if (!important) {
      let variantOrder = 0

      function variantItem(
        item: Omit<CompletionItem, 'kind' | 'data' | 'command' | 'sortText' | 'textEdit'>,
      ): CompletionItem {
        return {
          kind: 9,
          data: {
            ...(state.completionItemData ?? {}),
            _type: 'variant',
          },
          command:
            item.insertTextFormat === 2 // Snippet
              ? undefined
              : {
                  title: '',
                  command: 'editor.action.triggerSuggest',
                },
          sortText: '-' + naturalExpand(variantOrder++),
          ...item,
        }
      }

      for (let variant of state.variants) {
        if (existingVariants.includes(variant.name)) {
          continue
        }

        if (seenVariants.has(variant.name)) {
          continue
        }

        seenVariants.add(variant.name)

        if (variant.isArbitrary) {
          items.push(
            variantItem({
              label: `${variant.name}${variant.hasDash ? '-' : ''}[]${sep}`,
              insertTextFormat: 2,
              textEditText: `${variant.name}${variant.hasDash ? '-' : ''}[\${1}]${sep}\${0}`,
              // command: {
              //   title: '',
              //   command: 'tailwindCSS.onInsertArbitraryVariantSnippet',
              //   arguments: [variant.name, replacementRange],
              // },
            }),
          )
        } else {
          let shouldSortVariants = !semver.gte(state.version, '2.99.0')
          let resultingVariants = [...existingVariants, variant.name]

          if (shouldSortVariants) {
            let allVariants = state.variants.map(({ name }) => name)
            resultingVariants = resultingVariants.sort(
              (a, b) => allVariants.indexOf(b) - allVariants.indexOf(a),
            )
          }

          items.push(
            variantItem({
              label: `${variant.name}${sep}`,
              detail: variant
                .selectors()
                .map((selector) => addPixelEquivalentsToMediaQuery(selector))
                .join(', '),
              textEditText: resultingVariants[resultingVariants.length - 1] + sep,
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
            }),
          )
        }

        for (let value of variant.values ?? []) {
          if (existingVariants.includes(`${variant.name}-${value}`)) {
            continue
          }

          if (seenVariants.has(`${variant.name}-${value}`)) {
            continue
          }

          seenVariants.add(`${variant.name}-${value}`)

          items.push(
            variantItem({
              label:
                value === 'DEFAULT'
                  ? `${variant.name}${sep}`
                  : `${variant.name}${variant.hasDash ? '-' : ''}${value}${sep}`,
              detail: variant.selectors({ value }).join(', '),
            }),
          )
        }
      }
    }

    if (state.classList) {
      return withDefaults(
        {
          isIncomplete: false,
          items: items.concat(
            state.classList.reduce<CompletionItem[]>((items, [className, { color }], index) => {
              if (
                state.blocklist?.includes([...existingVariants, className].join(state.separator))
              ) {
                return items
              }

              let kind = color ? CompletionItemKind.Color : CompletionItemKind.Constant
              let documentation: string | undefined

              if (color && typeof color !== 'string') {
                documentation = formatColor(color)
              }

              items.push({
                label: className,
                kind,
                ...(documentation ? { documentation } : {}),
                sortText: naturalExpand(index, state.classList.length),
              })

              return items
            }, [] as CompletionItem[]),
          ),
        },
        {
          data: {
            ...(state.completionItemData ?? {}),
            ...(important ? { important } : {}),
            variants: existingVariants,
          },
          range: replacementRange,
        },
        state.editor.capabilities.itemDefaults,
      )
    }

    return withDefaults(
      {
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
              .map((className, index, classNames) => {
                let kind: CompletionItemKind = CompletionItemKind.Constant
                let documentation: string | undefined

                const color = getColor(state, className)
                if (color !== null) {
                  kind = CompletionItemKind.Color
                  if (typeof color !== 'string' && (color.alpha ?? 1) !== 0) {
                    documentation = formatColor(color)
                  }
                }

                return {
                  label: className,
                  kind,
                  ...(documentation ? { documentation } : {}),
                  sortText: naturalExpand(index, classNames.length),
                } as CompletionItem
              }),
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
      },
      {
        range: replacementRange,
        data: {
          ...(state.completionItemData ?? {}),
          variants: existingVariants,
          ...(important ? { important } : {}),
        },
      },
      state.editor.capabilities.itemDefaults,
    )
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

  return withDefaults(
    {
      isIncomplete: false,
      items: Object.keys(isSubset ? subset : state.classNames.classNames)
        .filter((k) => k !== '__info')
        .filter((className) => isContextItem(state, [...subsetKey, className]))
        .map((className, index, classNames): CompletionItem => {
          return {
            label: className + sep,
            kind: 9,
            command: {
              title: '',
              command: 'editor.action.triggerSuggest',
            },
            sortText: '-' + naturalExpand(index, classNames.length),
            data: {
              ...(state.completionItemData ?? {}),
              className,
              variants: subsetKey,
            },
          }
        })
        .concat(
          Object.keys(isSubset ? subset : state.classNames.classNames)
            .filter((className) =>
              dlv(state.classNames.classNames, [...subsetKey, className, '__info']),
            )
            .map((className, index, classNames) => {
              let kind: CompletionItemKind = CompletionItemKind.Constant
              let documentation: string | undefined

              const color = getColor(state, className)
              if (color !== null) {
                kind = CompletionItemKind.Color
                if (typeof color !== 'string' && (color.alpha ?? 1) !== 0) {
                  documentation = formatColor(color)
                }
              }

              return {
                label: className,
                kind,
                ...(documentation ? { documentation } : {}),
                sortText: naturalExpand(index, classNames.length),
              }
            }),
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
    },
    {
      range: replacementRange,
      data: {
        ...(state.completionItemData ?? {}),
        variants: subsetKey,
      },
    },
    state.editor.capabilities.itemDefaults,
  )
}

async function provideClassAttributeCompletions(
  state: State,
  document: TextDocument,
  position: Position,
  context?: CompletionContext,
): Promise<CompletionList> {
  let current = document.offsetAt(position)
  let range: Range = {
    start: document.positionAt(Math.max(0, current - SEARCH_RANGE)),
    end: position,
  }

  let str: string

  if (isJsDoc(state, document)) {
    str = getTextWithoutComments(document, 'js', range)
  } else if (isHtmlDoc(state, document)) {
    str = getTextWithoutComments(document, 'html', range)
  } else {
    str = document.getText(range)
  }

  let settings = (await state.editor.getConfiguration(document.uri)).tailwindCSS

  let matches = matchClassAttributes(str, settings.classAttributes)

  let boundaries = getLanguageBoundaries(state, document)

  for (let boundary of boundaries ?? []) {
    let isJsContext = boundary.type === 'js' || boundary.type === 'jsx'
    if (!isJsContext) continue
    if (!settings.classFunctions?.length) continue
    if (!isWithinRange(position, boundary.range)) continue

    let str = document.getText(boundary.range)
    let offset = document.offsetAt(boundary.range.start)
    let fnMatches = matchClassFunctions(str, settings.classFunctions)

    for (let match of fnMatches) {
      if (match.index) match.index += offset
      if (match.index > current) continue

      matches.push(match)
    }
  }

  // Make sure matches are sorted by index
  matches.sort((a, b) => a.index - b.index)

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
    if (last.type.startsWith('start') || last.type === 'classlist' || last.type.startsWith('arb')) {
      let classList = ''
      for (let i = tokens.length - 1; i >= 0; i--) {
        if (tokens[i].type === 'classlist' || tokens[i].type.startsWith('arb')) {
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
        settings.rootFontSize,
        undefined,
        context,
      )
    }
  } catch (_) {}

  return null
}

async function provideCustomClassNameCompletions(
  state: State,
  document: TextDocument,
  position: Position,
  context?: CompletionContext,
): Promise<CompletionList> {
  const settings = await state.editor.getConfiguration(document.uri)
  const filters = settings.tailwindCSS.experimental.classRegex
  if (filters.length === 0) return null

  const cursor = document.offsetAt(position)

  let text = document.getText({
    start: document.positionAt(0),
    end: document.positionAt(cursor + SEARCH_RANGE),
  })

  // Get completions from the first matching regex or regex pair
  for (let match of customClassesIn({ text, cursor, filters })) {
    return completionsFromClassList(
      state,
      match.classList,
      {
        start: {
          line: position.line,
          character: position.character - match.classList.length,
        },
        end: position,
      },
      settings.tailwindCSS.rootFontSize,
      undefined,
      context,
    )
  }

  return null
}

function provideThemeVariableCompletions(
  state: State,
  document: TextDocument,
  position: Position,
  _context?: CompletionContext,
): CompletionList {
  if (!state.v4) return null

  // Make sure we're in a CSS "context'
  if (!isCssContext(state, document, position)) return null
  let text = getTextWithoutComments(document, 'css', {
    start: { line: 0, character: 0 },
    end: position,
  })

  // Make sure we're completing a variable name (so start with `-`)
  // We don't check for `--` because VSCode does not call us again when the user types the second `-`
  if (!text.endsWith('-')) return null
  // Make sure we're inside a `@theme` block
  let themeBlock = text.lastIndexOf('@theme')
  if (themeBlock === -1) return null
  if (braceLevel(text.slice(themeBlock)) !== 1) return null

  let entries: ThemeEntry[] = [
    // Polyfill data for older versions of the design system
    { kind: 'variable', name: '--default-transition-duration' },
    { kind: 'variable', name: '--default-transition-timing-function' },
    { kind: 'variable', name: '--default-font-family' },
    { kind: 'variable', name: '--default-font-feature-settings' },
    { kind: 'variable', name: '--default-font-variation-settings' },
    { kind: 'variable', name: '--default-mono-font-family' },
    { kind: 'variable', name: '--default-mono-font-feature-settings' },
    { kind: 'variable', name: '--default-mono-font-variation-settings' },
    { kind: 'namespace', name: '--breakpoint' },
    { kind: 'namespace', name: '--color' },
    { kind: 'namespace', name: '--animate' },
    { kind: 'namespace', name: '--blur' },
    { kind: 'namespace', name: '--radius' },
    { kind: 'namespace', name: '--shadow' },
    { kind: 'namespace', name: '--inset-shadow' },
    { kind: 'namespace', name: '--drop-shadow' },
    { kind: 'namespace', name: '--spacing' },
    { kind: 'namespace', name: '--width' },
    { kind: 'namespace', name: '--font-family' },
    { kind: 'namespace', name: '--font-size' },
    { kind: 'namespace', name: '--letter-spacing' },
    { kind: 'namespace', name: '--line-height' },
    { kind: 'namespace', name: '--transition-timing-function' },
  ]

  if (semver.gte(state.version, '4.0.0-beta.1')) {
    entries = [
      { kind: 'variable', name: '--default-transition-duration' },
      { kind: 'variable', name: '--default-transition-timing-function' },
      { kind: 'variable', name: '--default-font-family' },
      { kind: 'variable', name: '--default-font-feature-settings' },
      { kind: 'variable', name: '--default-font-variation-settings' },
      { kind: 'variable', name: '--default-mono-font-family' },
      { kind: 'variable', name: '--default-mono-font-feature-settings' },
      { kind: 'variable', name: '--default-mono-font-variation-settings' },
      { kind: 'namespace', name: '--breakpoint' },
      { kind: 'namespace', name: '--color' },
      { kind: 'namespace', name: '--animate' },
      { kind: 'namespace', name: '--blur' },
      { kind: 'namespace', name: '--radius' },
      { kind: 'namespace', name: '--shadow' },
      { kind: 'namespace', name: '--inset-shadow' },
      { kind: 'namespace', name: '--drop-shadow' },
      { kind: 'variable', name: '--spacing' },
      { kind: 'namespace', name: '--container' },
      { kind: 'namespace', name: '--font' },
      { kind: 'namespace', name: '--text' },
      { kind: 'namespace', name: '--tracking' },
      { kind: 'namespace', name: '--leading' },
      { kind: 'namespace', name: '--ease' },
    ]
  }

  let items: CompletionItem[] = []

  for (let entry of entries) {
    items.push({
      label: entry.kind === 'namespace' ? `${entry.name}-` : entry.name,
      kind: CompletionItemKind.Variable,
    })
  }

  return withDefaults(
    {
      isIncomplete: false,
      items,
    },
    {
      data: {
        ...(state.completionItemData ?? {}),
      },
    },
    state.editor.capabilities.itemDefaults,
  )
}

async function provideAtApplyCompletions(
  state: State,
  document: TextDocument,
  position: Position,
  context?: CompletionContext,
): Promise<CompletionList> {
  let settings = (await state.editor.getConfiguration(document.uri)).tailwindCSS
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
    settings.rootFontSize,
    (item) => {
      if (item.kind === 9) {
        return (
          semver.gte(state.version, '2.0.0-alpha.1') || flagEnabled(state, 'applyComplexClasses')
        )
      }
      let variants = item.data?.variants ?? []
      let className = item.data?.className ?? item.label
      let validated = validateApply(state, [...variants, className])
      return validated !== null && validated.isApplyable === true
    },
    context,
  )
}

const NUMBER_REGEX = /^(\d+\.?|\d*\.\d+)$/
function isNumber(str: string): boolean {
  return NUMBER_REGEX.test(str)
}

async function provideClassNameCompletions(
  state: State,
  document: TextDocument,
  position: Position,
  context?: CompletionContext,
): Promise<CompletionList> {
  if (isCssContext(state, document, position)) {
    return provideAtApplyCompletions(state, document, position, context)
  }

  if (
    isHtmlContext(state, document, position) ||
    isJsContext(state, document, position) ||
    isJsxContext(state, document, position)
  ) {
    return provideClassAttributeCompletions(state, document, position, context)
  }

  return null
}

function provideCssHelperCompletions(
  state: State,
  document: TextDocument,
  position: Position,
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
    .match(/[\s:;/*(){}](?<helper>config|theme|--theme|var)\(\s*['"]?(?<path>[^)'"]*)$/d)

  if (match === null) {
    return null
  }

  let alpha: string
  let path = match.groups.path.replace(/^['"]+/g, '')
  let matches = path.match(/^([^\s]+)(?![^\[]*\])(?:\s*\/\s*([^\/\s]*))$/)
  if (matches) {
    path = matches[1]
    alpha = matches[2]
  }

  if (alpha !== undefined) {
    return null
  }

  let editRange = {
    start: {
      line: position.line,
      character: position.character,
    },
    end: position,
  }

  if (
    state.v4 &&
    (match.groups.helper === '--theme' ||
      match.groups.helper === 'theme' ||
      match.groups.helper === 'var')
  ) {
    let items: CompletionItem[] = themeKeyCompletions(state)

    editRange.start.character = match.indices.groups.helper[1] + 1

    return withDefaults(
      { isIncomplete: false, items },
      {
        range: editRange,
        data: {
          ...(state.completionItemData ?? {}),
          _type: 'helper',
        },
      },
      state.editor.capabilities.itemDefaults,
    )
  }

  if (match.groups.helper === 'var') return null

  let base = match.groups.helper === 'config' ? state.config : dlv(state.config, 'theme', {})
  let parts = path.split(/([\[\].]+)/)
  let keys = parts.filter((_, i) => i % 2 === 0)
  let separators = parts.filter((_, i) => i % 2 !== 0)
  // let obj =
  //   keys.length === 1 ? base : dlv(base, keys.slice(0, keys.length - 1), {})

  // if (!isObject(obj)) return null

  function totalLength(arr: string[]): number {
    return arr.reduce((acc, cur) => acc + cur.length, 0)
  }

  let obj: any
  let offset: number = keys[keys.length - 1].length
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

  editRange.start.character = position.character - offset

  return withDefaults(
    {
      isIncomplete: false,
      items: Object.keys(obj)
        .sort((a, z) => {
          let aIsNumber = isNumber(a)
          let zIsNumber = isNumber(z)
          if (aIsNumber && !zIsNumber) {
            return -1
          }
          if (!aIsNumber && zIsNumber) {
            return 1
          }
          if (aIsNumber && zIsNumber) {
            return parseFloat(a) - parseFloat(z)
          }
          return 0
        })
        .map((item, index, items) => {
          let color = getColorFromValue(obj[item])
          const replaceDot: boolean =
            item.indexOf('.') !== -1 && separator && separator.endsWith('.')
          const insertClosingBrace: boolean =
            text.charAt(text.length - 1) !== ']' &&
            (replaceDot || (separator && separator.endsWith('[')))
          const detail = stringifyConfigValue(obj[item])

          return {
            label: item,
            sortText: naturalExpand(index, items.length),
            commitCharacters: [!item.includes('.') && '.', !item.includes('[') && '['].filter(
              Boolean,
            ),
            kind: color ? 16 : isObject(obj[item]) ? 9 : 10,
            // VS Code bug causes some values to not display in some cases
            detail: detail === '0' || detail === 'transparent' ? `${detail} ` : detail,
            ...(color && typeof color !== 'string' && (color.alpha ?? 1) !== 0
              ? { documentation: formatColor(color) }
              : {}),
            ...(insertClosingBrace ? { textEditText: `${item}]` } : {}),
            additionalTextEdits: replaceDot
              ? [
                  {
                    newText: '[',
                    range: {
                      start: {
                        ...editRange.start,
                        character: editRange.start.character - 1,
                      },
                      end: editRange.start,
                    },
                  },
                ]
              : [],
          }
        }),
    },
    {
      range: editRange,
      data: {
        ...(state.completionItemData ?? {}),
        _type: 'helper',
      },
    },
    state.editor.capabilities.itemDefaults,
  )
}

function getCsstUtilityNameAtPosition(
  state: State,
  document: TextDocument,
  position: Position,
): { root: string; kind: 'static' | 'functional' } | null {
  if (!isCssContext(state, document, position)) return null
  if (!isInsideAtRule('utility', document, position)) return null

  let text = document.getText({
    start: { line: 0, character: 0 },
    end: position,
  })

  // Make sure we're in a functional utility block
  let block = text.lastIndexOf(`@utility`)
  if (block === -1) return null

  let curly = text.indexOf('{', block)
  if (curly === -1) return null

  let root = text.slice(block + 8, curly).trim()

  if (root.length === 0) return null

  if (root.endsWith('-*')) {
    root = root.slice(0, -2)

    if (root.length === 0) return null

    return { root, kind: 'functional' }
  }

  return { root: root, kind: 'static' }
}

function provideUtilityFunctionCompletions(
  state: State,
  document: TextDocument,
  position: Position,
): CompletionList {
  let utilityName = getCsstUtilityNameAtPosition(state, document, position)
  if (!utilityName) return null

  let text = document.getText({
    start: { line: position.line, character: 0 },
    end: position,
  })

  // Make sure we're in "value position"
  // e.g. --foo: <cursor>
  let pattern = /^[^:]+:[^;]*$/
  if (!pattern.test(text)) return null

  return withDefaults(
    {
      isIncomplete: false,
      items: [
        {
          label: '--value()',
          textEditText: '--value($1)',
          sortText: '-00000',
          insertTextFormat: InsertTextFormat.Snippet,
          kind: CompletionItemKind.Function,
          documentation: {
            kind: 'markdown' as typeof MarkupKind.Markdown,
            value: 'Reference a value based on the name of the utility. e.g. the `md` in `text-md`',
          },
          command: { command: 'editor.action.triggerSuggest', title: '' },
        },
        {
          label: '--modifier()',
          textEditText: '--modifier($1)',
          sortText: '-00001',
          insertTextFormat: InsertTextFormat.Snippet,
          kind: CompletionItemKind.Function,
          documentation: {
            kind: 'markdown' as typeof MarkupKind.Markdown,
            value: "Reference a value based on the utility's modifier. e.g. the `6` in `text-md/6`",
          },
        },
      ],
    },
    {
      data: {
        ...(state.completionItemData ?? {}),
      },
      range: {
        start: position,
        end: position,
      },
    },
    state.editor.capabilities.itemDefaults,
  )
}

async function provideUtilityFunctionArgumentCompletions(
  state: State,
  document: TextDocument,
  position: Position,
): Promise<CompletionList | null> {
  let utilityName = getCsstUtilityNameAtPosition(state, document, position)
  if (!utilityName) return null

  let text = document.getText({
    start: { line: position.line, character: 0 },
    end: position,
  })

  // Look to see if we're inside --value() or --modifier()
  let fn = null
  let fnStart = 0
  let valueIdx = text.lastIndexOf('--value(')
  let modifierIdx = text.lastIndexOf('--modifier(')
  let fnIdx = Math.max(valueIdx, modifierIdx)
  if (fnIdx === -1) return null

  if (fnIdx === valueIdx) {
    fn = '--value'
  } else if (fnIdx === modifierIdx) {
    fn = '--modifier'
  }

  fnStart = fnIdx + fn.length + 1

  // Make sure we're actaully inside the function
  if (parenLevel(text.slice(fnIdx)) === 0) return null

  let args = Array.from(await knownUtilityFunctionArguments(state, fn))

  let parts = segment(text.slice(fnStart), ',').map((s) => s.trim())

  // Only suggest at the start of the argument
  if (parts.at(-1) !== '') return null

  // Remove items that are already used
  args = args.filter((arg) => !parts.includes(arg.name))

  let items: CompletionItem[] = args.map((arg, idx) => ({
    label: arg.name,
    insertText: arg.name,
    kind: CompletionItemKind.Constant,
    sortText: naturalExpand(idx, args.length),
    documentation: {
      kind: 'markdown' as typeof MarkupKind.Markdown,
      value: arg.description.replace(/\{utility\}-/g, `${utilityName.root}-`),
    },
  }))

  return withDefaults(
    {
      isIncomplete: true,
      items,
    },
    {
      data: {
        ...(state.completionItemData ?? {}),
      },
      range: {
        start: position,
        end: position,
      },
    },
    state.editor.capabilities.itemDefaults,
  )
}

function provideTailwindDirectiveCompletions(
  state: State,
  document: TextDocument,
  position: Position,
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

  let items = [
    semver.gte(state.version, '1.0.0-beta.1')
      ? {
          label: 'base',
          documentation: {
            kind: 'markdown' as typeof MarkupKind.Markdown,
            value: `This injects Tailwind’s base styles and any base styles registered by plugins.\n\n[Tailwind CSS Documentation](${docsUrl(
              state.version,
              'functions-and-directives/#tailwind',
            )})`,
          },
        }
      : {
          label: 'preflight',
          documentation: {
            kind: 'markdown' as typeof MarkupKind.Markdown,
            value: `This injects Tailwind’s base styles, which is a combination of Normalize.css and some additional base styles.\n\n[Tailwind CSS Documentation](${docsUrl(
              state.version,
              'functions-and-directives/#tailwind',
            )})`,
          },
        },
    {
      label: 'components',
      documentation: {
        kind: 'markdown' as typeof MarkupKind.Markdown,
        value: `This injects Tailwind’s component classes and any component classes registered by plugins.\n\n[Tailwind CSS Documentation](${docsUrl(
          state.version,
          'functions-and-directives/#tailwind',
        )})`,
      },
    },
    {
      label: 'utilities',
      documentation: {
        kind: 'markdown' as typeof MarkupKind.Markdown,
        value: `This injects Tailwind’s utility classes and any utility classes registered by plugins.\n\n[Tailwind CSS Documentation](${docsUrl(
          state.version,
          'functions-and-directives/#tailwind',
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
              'just-in-time-mode#variants-are-inserted-at-tailwind-variants',
            )})`,
          },
        }
      : {
          label: 'screens',
          documentation: {
            kind: 'markdown' as typeof MarkupKind.Markdown,
            value: `Use this directive to control where Tailwind injects the responsive variations of each utility.\n\nIf omitted, Tailwind will append these classes to the very end of your stylesheet by default.\n\n[Tailwind CSS Documentation](${docsUrl(
              state.version,
              'functions-and-directives/#tailwind',
            )})`,
          },
        },
  ]

  return withDefaults(
    {
      isIncomplete: false,
      items: items.map((item) => ({
        ...item,
        kind: 21,
      })),
    },
    {
      data: {
        ...(state.completionItemData ?? {}),
        _type: '@tailwind',
      },
      range: {
        start: {
          line: position.line,
          character: position.character - match.groups.partial.length,
        },
        end: position,
      },
    },
    state.editor.capabilities.itemDefaults,
  )
}

function provideVariantsDirectiveCompletions(
  state: State,
  document: TextDocument,
  position: Position,
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

  let possibleVariants = state.variants.flatMap((variant) => {
    if (variant.values.length) {
      return variant.values.map((value) =>
        value === 'DEFAULT' ? variant.name : `${variant.name}${variant.hasDash ? '-' : ''}${value}`,
      )
    }
    return [variant.name]
  })
  const existingVariants = parts.slice(0, parts.length - 1)

  if (state.jit) {
    possibleVariants.unshift('responsive')
    possibleVariants = possibleVariants.filter((v) => !state.screens.includes(v))
  }

  return withDefaults(
    {
      isIncomplete: false,
      items: possibleVariants
        .filter((v) => existingVariants.indexOf(v) === -1)
        .map((variant, index, variants) => ({
          // TODO: detail
          label: variant,
          kind: 21,
          sortText: naturalExpand(index, variants.length),
        })),
    },
    {
      data: {
        ...(state.completionItemData ?? {}),
        _type: 'variant',
      },
      range: {
        start: {
          line: position.line,
          character: position.character - parts[parts.length - 1].length,
        },
        end: position,
      },
    },
    state.editor.capabilities.itemDefaults,
  )
}

function provideVariantDirectiveCompletions(
  state: State,
  document: TextDocument,
  position: Position,
): CompletionList {
  if (!state.v4) return null
  if (!isCssContext(state, document, position)) return null

  let text = document.getText({
    start: { line: position.line, character: 0 },
    end: position,
  })

  let match = text.match(/^\s*@variant\s+(?<partial>[^}]*)$/i)
  if (match === null) return null

  let partial = match.groups.partial.trim()

  // We only allow one variant `@variant` call
  if (/\s/.test(partial)) return null

  // We don't allow applying stacked variants so don't suggest them
  if (/:/.test(partial)) return null

  let possibleVariants = state.variants.flatMap((variant) => {
    if (variant.values.length) {
      return variant.values.map((value) =>
        value === 'DEFAULT' ? variant.name : `${variant.name}${variant.hasDash ? '-' : ''}${value}`,
      )
    }

    return [variant.name]
  })

  return withDefaults(
    {
      isIncomplete: false,
      items: possibleVariants.map((variant, index, variants) => ({
        label: variant,
        kind: 21,
        sortText: naturalExpand(index, variants.length),
      })),
    },
    {
      data: {
        ...(state.completionItemData ?? {}),
        _type: 'variant',
      },
      range: {
        start: {
          line: position.line,
          character: position.character,
        },
        end: position,
      },
    },
    state.editor.capabilities.itemDefaults,
  )
}

function provideLayerDirectiveCompletions(
  state: State,
  document: TextDocument,
  position: Position,
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

  let layerNames = ['base', 'components', 'utilities']

  if (state.v4) {
    layerNames = ['theme', 'base', 'components', 'utilities']
  }

  return withDefaults(
    {
      isIncomplete: false,
      items: layerNames.map((layer, index, layers) => ({
        label: layer,
        kind: 21,
        sortText: naturalExpand(index, layers.length),
      })),
    },
    {
      data: {
        ...(state.completionItemData ?? {}),
        _type: 'layer',
      },
      range: {
        start: {
          line: position.line,
          character: position.character - match.groups.partial.length,
        },
        end: position,
      },
    },
    state.editor.capabilities.itemDefaults,
  )
}

function withDefaults(
  completionList: CompletionList,
  defaults: Partial<{ data: any; range: Range }>,
  supportedDefaults: string[],
): CompletionList {
  let defaultData = supportedDefaults.includes('data')
  let defaultRange = supportedDefaults.includes('editRange')

  return {
    ...completionList,
    ...(defaultData || defaultRange
      ? {
          itemDefaults: {
            ...(defaultData && defaults.data ? { data: defaults.data } : {}),
            ...(defaultRange && defaults.range ? { editRange: defaults.range } : {}),
          },
        }
      : {}),
    items:
      defaultData && defaultRange
        ? completionList.items
        : completionList.items.map(({ textEditText, ...item }) => ({
            ...item,
            ...(defaultData || !defaults.data || item.data ? {} : { data: defaults.data }),
            ...(defaultRange || !defaults.range
              ? textEditText
                ? { textEditText }
                : {}
              : {
                  textEdit: {
                    newText: textEditText ?? item.label,
                    range: defaults.range,
                  },
                }),
          })),
  }
}

function provideScreenDirectiveCompletions(
  state: State,
  document: TextDocument,
  position: Position,
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

  return withDefaults(
    {
      isIncomplete: false,
      items: Object.keys(screens).map((screen, index) => ({
        label: screen,
        kind: 21,
        sortText: naturalExpand(index),
      })),
    },
    {
      data: {
        ...(state.completionItemData ?? {}),
        _type: 'screen',
      },
      range: {
        start: {
          line: position.line,
          character: position.character - match.groups.partial.length,
        },
        end: position,
      },
    },
    state.editor.capabilities.itemDefaults,
  )
}

function provideCssDirectiveCompletions(
  state: State,
  document: TextDocument,
  position: Position,
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

  let isNested = isInsideNesting(document, position)

  let items: CompletionItem[] = []

  if (state.v4) {
    // We don't suggest @tailwind anymore in v4 because we prefer that people
    // use the imports instead
  } else {
    items.push({
      label: '@tailwind',
      documentation: {
        kind: 'markdown' as typeof MarkupKind.Markdown,
        value: `Use the \`@tailwind\` directive to insert Tailwind’s \`base\`, \`components\`, \`utilities\` and \`${
          state.jit && semver.gte(state.version, '2.1.99') ? 'variants' : 'screens'
        }\` styles into your CSS.\n\n[Tailwind CSS Documentation](${docsUrl(
          state.version,
          'functions-and-directives/#tailwind',
        )})`,
      },
    })
  }

  if (!state.v4) {
    items.push({
      label: '@screen',
      documentation: {
        kind: 'markdown' as typeof MarkupKind.Markdown,
        value: `The \`@screen\` directive allows you to create media queries that reference your breakpoints by name instead of duplicating their values in your own CSS.\n\n[Tailwind CSS Documentation](${docsUrl(
          state.version,
          'functions-and-directives/#screen',
        )})`,
      },
    })
  }

  if (isNested) {
    items.push({
      label: '@apply',
      documentation: {
        kind: 'markdown' as typeof MarkupKind.Markdown,
        value: `Use \`@apply\` to inline any existing utility classes into your own custom CSS.\n\n[Tailwind CSS Documentation](${docsUrl(
          state.version,
          'functions-and-directives/#apply',
        )})`,
      },
    })
  }

  if (semver.gte(state.version, '1.8.0')) {
    items.push({
      label: '@layer',
      documentation: {
        kind: 'markdown' as typeof MarkupKind.Markdown,
        value: `Use the \`@layer\` directive to tell Tailwind which "bucket" a set of custom styles belong to. Valid layers are \`base\`, \`components\`, and \`utilities\`.\n\n[Tailwind CSS Documentation](${docsUrl(
          state.version,
          'functions-and-directives/#layer',
        )})`,
      },
    })
  }

  if (semver.gte(state.version, '2.99.0')) {
    //
  } else {
    items.push({
      label: '@variants',
      documentation: {
        kind: 'markdown' as typeof MarkupKind.Markdown,
        value: `You can generate \`responsive\`, \`hover\`, \`focus\`, \`active\`, and other variants of your own utilities by wrapping their definitions in the \`@variants\` directive.\n\n[Tailwind CSS Documentation](${docsUrl(
          state.version,
          'functions-and-directives/#variants',
        )})`,
      },
    })
    items.push({
      label: '@responsive',
      documentation: {
        kind: 'markdown' as typeof MarkupKind.Markdown,
        value: `You can generate responsive variants of your own classes by wrapping their definitions in the \`@responsive\` directive.\n\n[Tailwind CSS Documentation](${docsUrl(
          state.version,
          'functions-and-directives/#responsive',
        )})`,
      },
    })
  }

  if (semver.gte(state.version, '3.2.0') && !isNested) {
    items.push({
      label: '@config',
      documentation: {
        kind: 'markdown' as typeof MarkupKind.Markdown,
        value: `Use the \`@config\` directive to specify which config file Tailwind should use when compiling that CSS file.\n\n[Tailwind CSS Documentation](${docsUrl(
          state.version,
          'functions-and-directives/#config',
        )})`,
      },
    })
  }

  if (state.v4 && !isNested) {
    items.push({
      label: '@theme',
      documentation: {
        kind: 'markdown' as typeof MarkupKind.Markdown,
        value: `Use the \`@theme\` directive to specify which config file Tailwind should use when compiling that CSS file.\n\n[Tailwind CSS Documentation](${docsUrl(
          state.version,
          'functions-and-directives/#config',
        )})`,
      },
    })

    items.push({
      label: '@utility',
      documentation: {
        kind: 'markdown' as typeof MarkupKind.Markdown,
        value: `Use the \`@utility\` directive to define a custom utility.\n\n[Tailwind CSS Documentation](${docsUrl(
          state.version,
          'functions-and-directives/#utility',
        )})`,
      },
    })

    items.push({
      label: '@custom-variant',
      documentation: {
        kind: 'markdown' as typeof MarkupKind.Markdown,
        value: `Use the \`@custom-variant\` directive to define a custom variant or override an existing one.\n\n[Tailwind CSS Documentation](${docsUrl(
          state.version,
          'functions-and-directives/#custom-variant',
        )})`,
      },
    })

    items.push({
      label: '@source',
      documentation: {
        kind: 'markdown' as typeof MarkupKind.Markdown,
        value: `Use the \`@source\` directive to scan additional files for classes.\n\n[Tailwind CSS Documentation](${docsUrl(
          state.version,
          'functions-and-directives/#source',
        )})`,
      },
    })

    if (state.features.includes('source-not')) {
      items.push({
        label: '@source not',
        documentation: {
          kind: 'markdown' as typeof MarkupKind.Markdown,
          value: `Use the \`@source not\` directive to ignore files when scanning.\n\n[Tailwind CSS Documentation](${docsUrl(
            state.version,
            'functions-and-directives/#source',
          )})`,
        },
      })
    }

    items.push({
      label: '@plugin',
      documentation: {
        kind: 'markdown' as typeof MarkupKind.Markdown,
        value: `Use the \`@plugin\` directive to include a JS plugin in your Tailwind CSS build.\n\n[Tailwind CSS Documentation](${docsUrl(
          state.version,
          'functions-and-directives/#source',
        )})`,
      },
    })
  }

  if (state.v4 && isNested) {
    items.push({
      label: '@variant',
      documentation: {
        kind: 'markdown' as typeof MarkupKind.Markdown,
        value: `Use the \`@variant\` directive to use a variant in CSS.\n\n[Tailwind CSS Documentation](${docsUrl(
          state.version,
          'functions-and-directives/variant',
        )})`,
      },
    })

    // If we're inside an @custom-variant directive, also add `@slot`
    if (isInsideAtRule('custom-variant', document, position)) {
      items.push({
        label: '@slot',
        documentation: {
          kind: 'markdown' as typeof MarkupKind.Markdown,
          value: `Use the \`@slot\` directive to define where rules go in a custom variant.\n\n[Tailwind CSS Documentation](${docsUrl(
            state.version,
            'functions-and-directives/#slot',
          )})`,
        },

        // Make sure this appears as the first at-rule
        sortText: '-0000000',
      })
    }
  }

  return withDefaults(
    {
      isIncomplete: false,
      items: items.map((item) => ({
        ...item,
        kind: 14,
      })),
    },
    {
      data: {
        ...(state.completionItemData ?? {}),
        _type: 'directive',
      },
      range: {
        start: {
          line: position.line,
          character: position.character - match.groups.partial.length - 1,
        },
        end: position,
      },
    },
    state.editor.capabilities.itemDefaults,
  )
}

function isInsideAtRule(name: string, document: TextDocument, position: Position) {
  let text = document.getText({
    start: { line: 0, character: 0 },
    end: position,
  })

  // Find the last instance of the at-rule
  let block = text.lastIndexOf(`@${name}`)
  if (block === -1) return false

  // Check if we're inside it by counting the number of still-open braces
  return braceLevel(text.slice(block)) > 0
}

function isInsideNesting(document: TextDocument, position: Position) {
  let text = document.getText({
    start: { line: 0, character: 0 },
    end: position,
  })

  // Check if we're inside a rule by counting the number of still-open braces
  return braceLevel(text) > 0
}

// Provide completions for directives that take file paths
const PATTERN_AT_THEME = /@(?<directive>theme)\s+(?:(?<parts>[^{]+)\s$|$)/
const PATTERN_IMPORT_THEME = /@(?<directive>import)\s*[^;]+?theme\((?:(?<parts>[^)]+)\s$|$)/

async function provideThemeDirectiveCompletions(
  state: State,
  document: TextDocument,
  position: Position,
): Promise<CompletionList> {
  if (!state.v4) return null

  let text = document.getText({ start: { line: position.line, character: 0 }, end: position })

  let match = text.match(PATTERN_AT_THEME) ?? text.match(PATTERN_IMPORT_THEME)

  // Are we in a context where suggesting theme(…) stuff makes sense?
  if (!match) return null

  let directive = match.groups.directive
  let parts = new Set(
    (match.groups.parts ?? '')
      .trim()
      .split(/\s+/)
      .map((part) => part.trim())
      .filter((part) => part !== ''),
  )

  let items: CompletionItem[] = [
    {
      label: 'reference',
      documentation: {
        kind: 'markdown',
        value:
          directive === 'import'
            ? `Don't emit CSS variables for imported theme values.`
            : `Don't emit CSS variables for these theme values.`,
      },
      sortText: '-000000',
    },
    {
      label: 'inline',
      documentation: {
        kind: 'markdown',
        value:
          directive === 'import'
            ? `Inline imported theme values into generated utilities instead of using \`var(…)\`.`
            : `Inline these theme values into generated utilities instead of using \`var(…)\`.`,
      },
      sortText: '-000001',
    },
    {
      label: 'static',
      documentation: {
        kind: 'markdown',
        value:
          directive === 'import'
            ? `Always emit imported theme values into the CSS file instead of only when used.`
            : `Always emit these theme values into the CSS file instead of only when used.`,
      },
      sortText: '-000001',
    },
    {
      label: 'default',
      documentation: {
        kind: 'markdown',
        value:
          directive === 'import'
            ? `Allow imported theme values to be overriden by JS configs and plugins.`
            : `Allow these theme values to be overriden by JS configs and plugins.`,
      },
      sortText: '-000003',
    },
  ]

  items = items.filter((item) => !parts.has(item.label))

  if (items.length === 0) return null

  return withDefaults(
    {
      isIncomplete: false,
      items,
    },
    {
      data: {
        ...(state.completionItemData ?? {}),
        _type: 'filesystem',
      },
      range: {
        start: {
          line: position.line,
          character: position.character,
        },
        end: position,
      },
    },
    state.editor.capabilities.itemDefaults,
  )
}

// Provide completions for directives that take file paths
async function provideFileDirectiveCompletions(
  state: State,
  document: TextDocument,
  position: Position,
): Promise<CompletionList> {
  if (!isCssContext(state, document, position)) {
    return null
  }

  if (!semver.gte(state.version, '3.2.0')) {
    return null
  }

  let text = document.getText({ start: { line: position.line, character: 0 }, end: position })

  let fd = await findFileDirective(state, text)
  if (!fd) return null

  let { partial, suggest } = fd

  function isAllowedFile(name: string) {
    if (suggest === 'script') return IS_SCRIPT_SOURCE.test(name)

    if (suggest === 'source') return IS_TEMPLATE_SOURCE.test(name)

    // Files are not allowed but directories are
    if (suggest === 'directory') return false

    return false
  }

  let valueBeforeLastSlash = partial.substring(0, partial.lastIndexOf('/'))
  let valueAfterLastSlash = partial.substring(partial.lastIndexOf('/') + 1)

  let entries = await state.editor.readDirectory(document, valueBeforeLastSlash || '.')

  entries = entries.filter(([name, type]) => {
    return type.isDirectory || isAllowedFile(name)
  })

  let items: CompletionItem[] = entries.map(([name, type]) => ({
    label: type.isDirectory ? name + '/' : name,
    kind: type.isDirectory ? 19 : 17,
    command: type.isDirectory ? { command: 'editor.action.triggerSuggest', title: '' } : undefined,
  }))

  return withDefaults(
    {
      isIncomplete: false,
      items,
    },
    {
      data: {
        ...(state.completionItemData ?? {}),
        _type: 'filesystem',
      },
      range: {
        start: {
          line: position.line,
          character: position.character - valueAfterLastSlash.length,
        },
        end: position,
      },
    },
    state.editor.capabilities.itemDefaults,
  )
}

async function provideEmmetCompletions(
  state: State,
  document: TextDocument,
  position: Position,
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
          (abbreviation.startsWith(symbol.name + '.') && !/>|\*|\+/.test(abbreviation)),
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

  return completionsFromClassList(
    state,
    parts[parts.length - 1],
    {
      start: {
        line: position.line,
        character: position.character - parts[parts.length - 1].length,
      },
      end: position,
    },
    settings.tailwindCSS.rootFontSize,
  )
}

export async function doComplete(
  state: State,
  document: TextDocument,
  position: Position,
  context?: CompletionContext,
): Promise<CompletionList | null> {
  if (state === null) return { items: [], isIncomplete: false }

  const result =
    (await provideClassNameCompletions(state, document, position, context)) ||
    (await provideThemeDirectiveCompletions(state, document, position)) ||
    (await provideUtilityFunctionArgumentCompletions(state, document, position)) ||
    provideUtilityFunctionCompletions(state, document, position) ||
    provideCssHelperCompletions(state, document, position) ||
    provideCssDirectiveCompletions(state, document, position) ||
    provideScreenDirectiveCompletions(state, document, position) ||
    provideVariantDirectiveCompletions(state, document, position) ||
    provideVariantsDirectiveCompletions(state, document, position) ||
    provideTailwindDirectiveCompletions(state, document, position) ||
    provideLayerDirectiveCompletions(state, document, position) ||
    (await provideFileDirectiveCompletions(state, document, position)) ||
    (await provideCustomClassNameCompletions(state, document, position, context)) ||
    provideThemeVariableCompletions(state, document, position, context)

  if (result) return result

  return provideEmmetCompletions(state, document, position)
}

export async function resolveCompletionItem(
  state: State,
  item: CompletionItem,
): Promise<CompletionItem> {
  if (
    ['helper', 'directive', 'variant', 'layer', '@tailwind', 'filesystem'].includes(
      item.data?._type,
    )
  ) {
    return item
  }

  if (item.data?._type === 'screen') {
    let screens = dlv(state.config, ['theme', 'screens'], dlv(state.config, ['screens'], {}))
    if (!isObject(screens)) screens = {}
    item.detail = stringifyScreen(screens[item.label] as Screen)
    return item
  }

  let className = item.data?.className ?? item.label
  if (item.data?.important) {
    className = `!${className}`
  }
  let variants = item.data?.variants ?? []

  if (state.v4) {
    if (item.kind === 9) return item
    if (item.detail && item.documentation) return item

    let base = state.designSystem.compile([className])[0]
    let root = state.designSystem.compile([[...variants, className].join(state.separator)])[0]

    let rules = root.nodes.filter((node) => node.type === 'rule')
    if (rules.length === 0) return item

    if (!item.detail) {
      if (rules.length === 1) {
        let decls: postcss.Declaration[] = []

        // Remove any `@property` rules
        base = base.clone()
        base.walkAtRules((rule) => {
          // Ignore declarations inside `@property` rules
          if (rule.name === 'property') {
            rule.remove()
          }

          // Ignore declarations @supports (-moz-orient: inline)
          // this is a hack used for `@property` fallbacks in Firefox
          if (rule.name === 'supports' && rule.params === '(-moz-orient: inline)') {
            rule.remove()
          }
        })

        base.walkDecls((node) => {
          decls.push(node)
        })

        item.detail = await jit.stringifyDecls(state, postcss.rule({ nodes: decls }))
      } else {
        item.detail = `${rules.length} rules`
      }
    }

    if (!item.documentation) {
      item.documentation = {
        kind: 'markdown' as typeof MarkupKind.Markdown,
        value: [
          '```css',
          await jit.stringifyRoot(state, postcss.root({ nodes: rules })),
          '```',
        ].join('\n'),
      }
    }

    return item
  }

  if (state.jit) {
    if (item.kind === 9) return item
    if (item.detail && item.documentation) return item
    let { root, rules } = jit.generateRules(state, [[...variants, className].join(state.separator)])
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

  const rules = dlv(state.classNames.classNames, [...variants, className, '__info'])
  if (item.kind === 9) {
    item.detail = state.classNames.context[className].join(', ')
  } else {
    item.detail = await getCssDetail(state, rules)
    if (!item.documentation) {
      const settings = await state.editor.getConfiguration()
      const css = stringifyCss([...variants, className].join(':'), rules, settings)
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
  const item = dlv(state.classNames.classNames, keys)

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

function stringifyDecls(obj: any, settings: Settings): string {
  let props = Object.keys(obj)
  let nonCustomProps = props.filter((prop) => !prop.startsWith('--'))

  if (props.length !== nonCustomProps.length && nonCustomProps.length !== 0) {
    props = nonCustomProps
  }

  return props
    .map((prop) =>
      ensureArray(obj[prop])
        .map((value) => {
          if (settings.tailwindCSS.showPixelEquivalents) {
            value = addPixelEquivalentsToValue(value, settings.tailwindCSS.rootFontSize)
          }
          return `${prop}: ${value};`
        })
        .join(' '),
    )
    .join(' ')
}

async function getCssDetail(state: State, className: any): Promise<string> {
  if (Array.isArray(className)) {
    return `${className.length} rules`
  }
  if (className.__rule === true) {
    const settings = await state.editor.getConfiguration()
    return stringifyDecls(removeMeta(className), settings)
  }
  return null
}

type UtilityFn = '--value' | '--modifier'

interface UtilityFnArg {
  name: string
  description: string
}

async function knownUtilityFunctionArguments(state: State, fn: UtilityFn): Promise<UtilityFnArg[]> {
  if (!state.designSystem) return []

  let args: UtilityFnArg[] = []

  let namespaces = resolveKnownThemeNamespaces(state.designSystem)

  for (let ns of namespaces) {
    args.push({
      name: `${ns}-*`,
      description: `Support theme values from \`${ns}-*\``,
    })
  }

  args.push({
    name: 'integer',
    description: 'Support integer values, e.g. `{utility}-6`',
  })

  args.push({
    name: 'number',
    description:
      'Support numeric values in increments of 0.25, e.g. `{utility}-6` and `{utility}-7.25`',
  })

  args.push({
    name: 'percentage',
    description: 'Support integer percentage values, e.g. `{utility}-50%` and `{utility}-21%`',
  })

  if (fn === '--value') {
    args.push({
      name: 'ratio',
      description: 'Support fractions, e.g. `{utility}-1/5` and `{utility}-16/9`',
    })
  }

  args.push({
    name: '[integer]',
    description: 'Support arbitrary integer values, e.g. `{utility}-[123]`',
  })

  args.push({
    name: '[number]',
    description: 'Support arbitrary numeric values, e.g. `{utility}-[10]` and `{utility}-[10.234]`',
  })

  args.push({
    name: '[percentage]',
    description:
      'Support arbitrary percentage values, e.g. `{utility}-[10%]` and `{utility}-[10.234%]`',
  })

  args.push({
    name: '[ratio]',
    description: 'Support arbitrary fractions, e.g. `{utility}-[1/5]` and `{utility}-[16/9]`',
  })

  args.push({
    name: '[color]',
    description:
      'Support arbitrary color values, e.g. `{utility}-[#639]` and `{utility}-[oklch(44.03% 0.1603 303.37)]`',
  })

  args.push({
    name: '[angle]',
    description: 'Support arbitrary angle, e.g. `{utility}-[12deg]` and `{utility}-[0.21rad]`',
  })

  args.push({
    name: '[url]',
    description: "Support arbitrary URL functions, e.g. `{utility}-['url(…)']`",
  })

  return args
}

export function themeKeyCompletions(state: State): CompletionItem[] {
  if (!state.v4) return null
  if (!state.designSystem) return null

  let knownThemeKeys = resolveKnownThemeKeys(state.designSystem)

  return knownThemeKeys.map((themeKey, index) => {
    let value = state.designSystem.resolveThemeValue(themeKey, true)
    let documentation: string | undefined

    let color = getColorFromValue(value)
    if (color !== null) {
      if (typeof color !== 'string' && (color.alpha ?? 1) !== 0) {
        documentation = formatColor(color)
      }

      return {
        label: themeKey,
        kind: CompletionItemKind.Color,
        sortText: naturalExpand(index, knownThemeKeys.length),
        detail: value,
        documentation,
      }
    }

    return {
      label: themeKey,
      kind: CompletionItemKind.Variable,
      sortText: naturalExpand(index, knownThemeKeys.length),
      detail: value,
    }
  })
}
