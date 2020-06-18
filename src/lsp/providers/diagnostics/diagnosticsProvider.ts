import { TextDocument, DiagnosticSeverity, Range } from 'vscode-languageserver'
import { State, Settings } from '../../util/state'
import { isCssDoc } from '../../util/css'
import {
  findClassNamesInRange,
  findClassListsInDocument,
  getClassNamesInClassList,
  findAll,
  indexToPosition,
} from '../../util/find'
import { getClassNameMeta } from '../../util/getClassNameMeta'
import { getClassNameDecls } from '../../util/getClassNameDecls'
import { equal } from '../../../util/array'
import { getDocumentSettings } from '../../util/getDocumentSettings'
const dlv = require('dlv')
import semver from 'semver'
import { getLanguageBoundaries } from '../../util/getLanguageBoundaries'
import { absoluteRange } from '../../util/absoluteRange'
import { isObject } from '../../../class-names/isObject'
import { stringToPath } from '../../util/stringToPath'
import { closest } from '../../util/closest'
import {
  InvalidApplyDiagnostic,
  DiagnosticKind,
  UtilityConflictsDiagnostic,
  InvalidScreenDiagnostic,
  InvalidVariantDiagnostic,
  InvalidConfigPathDiagnostic,
  InvalidTailwindDirectiveDiagnostic,
  AugmentedDiagnostic,
} from './types'
import { joinWithAnd } from '../../util/joinWithAnd'

function getInvalidApplyDiagnostics(
  state: State,
  document: TextDocument,
  settings: Settings
): InvalidApplyDiagnostic[] {
  let severity = settings.lint.invalidApply
  if (severity === 'ignore') return []

  const classNames = findClassNamesInRange(document, undefined, 'css')

  let diagnostics: InvalidApplyDiagnostic[] = classNames.map((className) => {
    const meta = getClassNameMeta(state, className.className)
    if (!meta) return null

    let message: string

    if (Array.isArray(meta)) {
      message = `'@apply' cannot be used with '${className.className}' because it is included in multiple rulesets.`
    } else if (meta.source !== 'utilities') {
      message = `'@apply' cannot be used with '${className.className}' because it is not a utility.`
    } else if (meta.context && meta.context.length > 0) {
      if (meta.context.length === 1) {
        message = `'@apply' cannot be used with '${className.className}' because it is nested inside of an at-rule ('${meta.context[0]}').`
      } else {
        message = `'@apply' cannot be used with '${
          className.className
        }' because it is nested inside of at-rules (${meta.context
          .map((c) => `'${c}'`)
          .join(', ')}).`
      }
    } else if (meta.pseudo && meta.pseudo.length > 0) {
      if (meta.pseudo.length === 1) {
        message = `'@apply' cannot be used with '${className.className}' because its definition includes a pseudo-selector ('${meta.pseudo[0]}')`
      } else {
        message = `'@apply' cannot be used with '${
          className.className
        }' because its definition includes pseudo-selectors (${meta.pseudo
          .map((p) => `'${p}'`)
          .join(', ')}).`
      }
    }

    if (!message) return null

    return {
      code: DiagnosticKind.InvalidApply,
      severity:
        severity === 'error'
          ? DiagnosticSeverity.Error
          : DiagnosticSeverity.Warning,
      range: className.range,
      message,
      className,
    }
  })

  return diagnostics.filter(Boolean)
}

function getUtilityConflictDiagnostics(
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

function getInvalidScreenDiagnostics(
  state: State,
  document: TextDocument,
  settings: Settings
): InvalidScreenDiagnostic[] {
  let severity = settings.lint.invalidScreen
  if (severity === 'ignore') return []

  let diagnostics: InvalidScreenDiagnostic[] = []
  let ranges: Range[] = []

  if (isCssDoc(state, document)) {
    ranges.push(undefined)
  } else {
    let boundaries = getLanguageBoundaries(state, document)
    if (!boundaries) return []
    ranges.push(...boundaries.css)
  }

  ranges.forEach((range) => {
    let text = document.getText(range)
    let matches = findAll(/(?:\s|^)@screen\s+(?<screen>[^\s{]+)/g, text)

    let screens = Object.keys(
      dlv(state.config, 'theme.screens', dlv(state.config, 'screens', {}))
    )

    matches.forEach((match) => {
      if (screens.includes(match.groups.screen)) {
        return null
      }

      let message = `The screen '${match.groups.screen}' does not exist in your theme config.`
      let suggestion = closest(match.groups.screen, screens)
      if (suggestion) {
        message += ` Did you mean '${suggestion}'?`
      }

      diagnostics.push({
        code: DiagnosticKind.InvalidScreen,
        range: absoluteRange(
          {
            start: indexToPosition(
              text,
              match.index + match[0].length - match.groups.screen.length
            ),
            end: indexToPosition(text, match.index + match[0].length),
          },
          range
        ),
        severity:
          severity === 'error'
            ? DiagnosticSeverity.Error
            : DiagnosticSeverity.Warning,
        message,
      })
    })
  })

  return diagnostics
}

function getInvalidVariantDiagnostics(
  state: State,
  document: TextDocument,
  settings: Settings
): InvalidVariantDiagnostic[] {
  let severity = settings.lint.invalidVariant
  if (severity === 'ignore') return []

  let diagnostics: InvalidVariantDiagnostic[] = []
  let ranges: Range[] = []

  if (isCssDoc(state, document)) {
    ranges.push(undefined)
  } else {
    let boundaries = getLanguageBoundaries(state, document)
    if (!boundaries) return []
    ranges.push(...boundaries.css)
  }

  ranges.forEach((range) => {
    let text = document.getText(range)
    let matches = findAll(/(?:\s|^)@variants\s+(?<variants>[^{]+)/g, text)

    matches.forEach((match) => {
      let variants = match.groups.variants.split(/(\s*,\s*)/)
      let listStartIndex =
        match.index + match[0].length - match.groups.variants.length

      for (let i = 0; i < variants.length; i += 2) {
        let variant = variants[i].trim()
        if (state.variants.includes(variant)) {
          continue
        }

        let message = `The variant '${variant}' does not exist.`
        let suggestion = closest(variant, state.variants)
        if (suggestion) {
          message += ` Did you mean '${suggestion}'?`
        }

        let variantStartIndex =
          listStartIndex + variants.slice(0, i).join('').length

        diagnostics.push({
          code: DiagnosticKind.InvalidVariant,
          range: absoluteRange(
            {
              start: indexToPosition(text, variantStartIndex),
              end: indexToPosition(text, variantStartIndex + variant.length),
            },
            range
          ),
          severity:
            severity === 'error'
              ? DiagnosticSeverity.Error
              : DiagnosticSeverity.Warning,
          message,
        })
      }
    })
  })

  return diagnostics
}

function getInvalidConfigPathDiagnostics(
  state: State,
  document: TextDocument,
  settings: Settings
): InvalidConfigPathDiagnostic[] {
  let severity = settings.lint.invalidConfigPath
  if (severity === 'ignore') return []

  let diagnostics: InvalidConfigPathDiagnostic[] = []
  let ranges: Range[] = []

  if (isCssDoc(state, document)) {
    ranges.push(undefined)
  } else {
    let boundaries = getLanguageBoundaries(state, document)
    if (!boundaries) return []
    ranges.push(...boundaries.css)
  }

  ranges.forEach((range) => {
    let text = document.getText(range)
    let matches = findAll(
      /(?<prefix>\s|^)(?<helper>config|theme)\((?<quote>['"])(?<key>[^)]+)\k<quote>\)/g,
      text
    )

    matches.forEach((match) => {
      let base = match.groups.helper === 'theme' ? ['theme'] : []
      let keys = stringToPath(match.groups.key)
      let value = dlv(state.config, [...base, ...keys])

      const isValid = (val: unknown): boolean =>
        typeof val === 'string' ||
        typeof val === 'number' ||
        val instanceof String ||
        val instanceof Number ||
        Array.isArray(val)

      const stitch = (keys: string[]): string =>
        keys.reduce((acc, cur, i) => {
          if (i === 0) return cur
          if (cur.includes('.')) return `${acc}[${cur}]`
          return `${acc}.${cur}`
        }, '')

      let message: string

      if (isValid(value)) {
        // The value resolves successfully, but we need to check that there
        // wasn't any funny business. If you have a theme object:
        // { msg: 'hello' } and do theme('msg.0')
        // this will resolve to 'h', which is probably not intentional, so we
        // check that all of the keys are object or array keys (i.e. not string
        // indexes)
        let valid = true
        for (let i = keys.length - 1; i >= 0; i--) {
          let key = keys[i]
          let parentValue = dlv(state.config, [...base, ...keys.slice(0, i)])
          if (/^[0-9]+$/.test(key)) {
            if (!isObject(parentValue) && !Array.isArray(parentValue)) {
              valid = false
              break
            }
          } else if (!isObject(parentValue)) {
            valid = false
            break
          }
        }
        if (!valid) {
          message = `'${match.groups.key}' does not exist in your theme config.`
        }
      } else if (typeof value === 'undefined') {
        message = `'${match.groups.key}' does not exist in your theme config.`
        let parentValue = dlv(state.config, [
          ...base,
          ...keys.slice(0, keys.length - 1),
        ])
        if (isObject(parentValue)) {
          let closestValidKey = closest(
            keys[keys.length - 1],
            Object.keys(parentValue).filter((key) => isValid(parentValue[key]))
          )
          if (closestValidKey) {
            message += ` Did you mean '${stitch([
              ...keys.slice(0, keys.length - 1),
              closestValidKey,
            ])}'?`
          }
        }
      } else {
        message = `'${match.groups.key}' was found but does not resolve to a string.`

        if (isObject(value)) {
          let firstValidKey = Object.keys(value).find((key) =>
            isValid(value[key])
          )
          if (firstValidKey) {
            message += ` Did you mean something like '${stitch([
              ...keys,
              firstValidKey,
            ])}'?`
          }
        }
      }

      if (!message) {
        return null
      }

      let startIndex =
        match.index +
        match.groups.prefix.length +
        match.groups.helper.length +
        1 + // open paren
        match.groups.quote.length

      diagnostics.push({
        code: DiagnosticKind.InvalidConfigPath,
        range: absoluteRange(
          {
            start: indexToPosition(text, startIndex),
            end: indexToPosition(text, startIndex + match.groups.key.length),
          },
          range
        ),
        severity:
          severity === 'error'
            ? DiagnosticSeverity.Error
            : DiagnosticSeverity.Warning,
        message,
      })
    })
  })

  return diagnostics
}

function getInvalidTailwindDirectiveDiagnostics(
  state: State,
  document: TextDocument,
  settings: Settings
): InvalidTailwindDirectiveDiagnostic[] {
  let severity = settings.lint.invalidTailwindDirective
  if (severity === 'ignore') return []

  let diagnostics: InvalidTailwindDirectiveDiagnostic[] = []
  let ranges: Range[] = []

  if (isCssDoc(state, document)) {
    ranges.push(undefined)
  } else {
    let boundaries = getLanguageBoundaries(state, document)
    if (!boundaries) return []
    ranges.push(...boundaries.css)
  }

  ranges.forEach((range) => {
    let text = document.getText(range)
    let matches = findAll(/(?:\s|^)@tailwind\s+(?<value>[^;]+)/g, text)

    let valid = [
      'utilities',
      'components',
      'screens',
      semver.gte(state.version, '1.0.0-beta.1') ? 'base' : 'preflight',
    ]

    matches.forEach((match) => {
      if (valid.includes(match.groups.value)) {
        return null
      }

      let message = `'${match.groups.value}' is not a valid group.`
      if (match.groups.value === 'preflight') {
        message += ` Did you mean 'base'?`
      } else {
        let suggestion = closest(match.groups.value, valid)
        if (suggestion) {
          message += ` Did you mean '${suggestion}'?`
        }
      }

      diagnostics.push({
        code: DiagnosticKind.InvalidTailwindDirective,
        range: absoluteRange(
          {
            start: indexToPosition(
              text,
              match.index + match[0].length - match.groups.value.length
            ),
            end: indexToPosition(text, match.index + match[0].length),
          },
          range
        ),
        severity:
          severity === 'error'
            ? DiagnosticSeverity.Error
            : DiagnosticSeverity.Warning,
        message,
      })
    })
  })

  return diagnostics
}

export async function getDiagnostics(
  state: State,
  document: TextDocument,
  only: DiagnosticKind[] = [
    DiagnosticKind.UtilityConflicts,
    DiagnosticKind.InvalidApply,
    DiagnosticKind.InvalidScreen,
    DiagnosticKind.InvalidVariant,
    DiagnosticKind.InvalidConfigPath,
    DiagnosticKind.InvalidTailwindDirective,
  ]
): Promise<AugmentedDiagnostic[]> {
  const settings = await getDocumentSettings(state, document)

  return settings.validate
    ? [
        ...(only.includes(DiagnosticKind.UtilityConflicts)
          ? getUtilityConflictDiagnostics(state, document, settings)
          : []),
        ...(only.includes(DiagnosticKind.InvalidApply)
          ? getInvalidApplyDiagnostics(state, document, settings)
          : []),
        ...(only.includes(DiagnosticKind.InvalidScreen)
          ? getInvalidScreenDiagnostics(state, document, settings)
          : []),
        ...(only.includes(DiagnosticKind.InvalidVariant)
          ? getInvalidVariantDiagnostics(state, document, settings)
          : []),
        ...(only.includes(DiagnosticKind.InvalidConfigPath)
          ? getInvalidConfigPathDiagnostics(state, document, settings)
          : []),
        ...(only.includes(DiagnosticKind.InvalidTailwindDirective)
          ? getInvalidTailwindDirectiveDiagnostics(state, document, settings)
          : []),
      ]
    : []
}

export async function provideDiagnostics(state: State, document: TextDocument) {
  state.editor.connection.sendDiagnostics({
    uri: document.uri,
    diagnostics: await getDiagnostics(state, document),
  })
}

export function clearDiagnostics(state: State, document: TextDocument): void {
  state.editor.connection.sendDiagnostics({
    uri: document.uri,
    diagnostics: [],
  })
}

export function clearAllDiagnostics(state: State): void {
  state.editor.documents.all().forEach((document) => {
    clearDiagnostics(state, document)
  })
}

export function updateAllDiagnostics(state: State): void {
  state.editor.documents.all().forEach((document) => {
    provideDiagnostics(state, document)
  })
}
