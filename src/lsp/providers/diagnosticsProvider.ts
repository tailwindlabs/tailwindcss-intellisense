import {
  TextDocument,
  Diagnostic,
  DiagnosticSeverity,
  Range,
} from 'vscode-languageserver'
import { State, Settings } from '../util/state'
import { isCssDoc } from '../util/css'
import {
  findClassNamesInRange,
  findClassListsInDocument,
  getClassNamesInClassList,
  findAll,
  indexToPosition,
} from '../util/find'
import { getClassNameMeta } from '../util/getClassNameMeta'
import { getClassNameDecls } from '../util/getClassNameDecls'
import { equal } from '../../util/array'
import { getDocumentSettings } from '../util/getDocumentSettings'
const dlv = require('dlv')
import semver from 'semver'
import { getLanguageBoundaries } from '../util/getLanguageBoundaries'
import { absoluteRange } from '../util/absoluteRange'
import { isObject } from '../../class-names/isObject'
import { stringToPath } from '../util/stringToPath'
import { closest } from '../util/closest'

function getUnsupportedApplyDiagnostics(
  state: State,
  document: TextDocument,
  settings: Settings
): Diagnostic[] {
  let severity = settings.lint.unsupportedApply
  if (severity === 'ignore') return []

  const classNames = findClassNamesInRange(document, undefined, 'css')

  let diagnostics: Diagnostic[] = classNames
    .map(({ className, range }) => {
      const meta = getClassNameMeta(state, className)
      if (!meta) return null

      let message: string

      if (Array.isArray(meta)) {
        message = `\`@apply\` cannot be used with \`.${className}\` because it is included in multiple rulesets.`
      } else if (meta.source !== 'utilities') {
        message = `\`@apply\` cannot be used with \`.${className}\` because it is not a utility.`
      } else if (meta.context && meta.context.length > 0) {
        if (meta.context.length === 1) {
          message = `\`@apply\` cannot be used with \`.${className}\` because it is nested inside of an at-rule (${meta.context[0]}).`
        } else {
          message = `\`@apply\` cannot be used with \`.${className}\` because it is nested inside of at-rules (${meta.context.join(
            ', '
          )}).`
        }
      } else if (meta.pseudo && meta.pseudo.length > 0) {
        if (meta.pseudo.length === 1) {
          message = `\`@apply\` cannot be used with \`.${className}\` because its definition includes a pseudo-selector (${meta.pseudo[0]})`
        } else {
          message = `\`@apply\` cannot be used with \`.${className}\` because its definition includes pseudo-selectors (${meta.pseudo.join(
            ', '
          )})`
        }
      }

      if (!message) return null

      return {
        severity:
          severity === 'error'
            ? DiagnosticSeverity.Error
            : DiagnosticSeverity.Warning,
        range,
        message,
      }
    })
    .filter(Boolean)

  return diagnostics
}

function getUtilityConflictDiagnostics(
  state: State,
  document: TextDocument,
  settings: Settings
): Diagnostic[] {
  let severity = settings.lint.utilityConflicts
  if (severity === 'ignore') return []

  let diagnostics: Diagnostic[] = []
  const classLists = findClassListsInDocument(state, document)

  classLists.forEach((classList) => {
    const classNames = getClassNamesInClassList(classList)

    classNames.forEach((className, index) => {
      let otherClassNames = classNames.filter((_className, i) => i !== index)
      otherClassNames.forEach((otherClassName) => {
        let decls = getClassNameDecls(state, className.className)
        if (!decls) return

        let otherDecls = getClassNameDecls(state, otherClassName.className)
        if (!otherDecls) return

        let meta = getClassNameMeta(state, className.className)
        let otherMeta = getClassNameMeta(state, otherClassName.className)

        if (
          equal(Object.keys(decls), Object.keys(otherDecls)) &&
          !Array.isArray(meta) &&
          !Array.isArray(otherMeta) &&
          equal(meta.context, otherMeta.context) &&
          equal(meta.pseudo, otherMeta.pseudo)
        ) {
          diagnostics.push({
            range: className.range,
            severity:
              severity === 'error'
                ? DiagnosticSeverity.Error
                : DiagnosticSeverity.Warning,
            message: `You can’t use \`${className.className}\` and \`${otherClassName.className}\` together`,
            relatedInformation: [
              {
                message: otherClassName.className,
                location: {
                  uri: document.uri,
                  range: otherClassName.range,
                },
              },
            ],
          })
        }
      })
    })
  })

  return diagnostics
}

function getUnknownScreenDiagnostics(
  state: State,
  document: TextDocument,
  settings: Settings
): Diagnostic[] {
  let severity = settings.lint.unknownScreen
  if (severity === 'ignore') return []

  let diagnostics: Diagnostic[] = []
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

function getUnknownVariantDiagnostics(
  state: State,
  document: TextDocument,
  settings: Settings
): Diagnostic[] {
  let severity = settings.lint.unknownVariant
  if (severity === 'ignore') return []

  let diagnostics: Diagnostic[] = []
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

function getInvalidHelperKeyDiagnostics(
  state: State,
  document: TextDocument,
  settings: Settings
): Diagnostic[] {
  let severity = settings.lint.invalidHelperKey
  if (severity === 'ignore') return []

  let diagnostics: Diagnostic[] = []
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
            message += ` Did you mean '${stitch([...keys, firstValidKey])}'?`
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

function getUnsupportedTailwindDirectiveDiagnostics(
  state: State,
  document: TextDocument,
  settings: Settings
): Diagnostic[] {
  let severity = settings.lint.unsupportedTailwindDirective
  if (severity === 'ignore') return []

  let diagnostics: Diagnostic[] = []
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

export async function provideDiagnostics(
  state: State,
  document: TextDocument
): Promise<void> {
  const settings = await getDocumentSettings(state, document)

  const diagnostics: Diagnostic[] = settings.validate
    ? [
        ...getUtilityConflictDiagnostics(state, document, settings),
        ...getUnsupportedApplyDiagnostics(state, document, settings),
        ...getUnknownScreenDiagnostics(state, document, settings),
        ...getUnknownVariantDiagnostics(state, document, settings),
        ...getInvalidHelperKeyDiagnostics(state, document, settings),
        ...getUnsupportedTailwindDirectiveDiagnostics(
          state,
          document,
          settings
        ),
      ]
    : []

  state.editor.connection.sendDiagnostics({
    uri: document.uri,
    diagnostics,
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
