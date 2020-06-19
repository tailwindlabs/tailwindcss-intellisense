import { State, Settings } from '../../util/state'
import { TextDocument, Range, DiagnosticSeverity } from 'vscode-languageserver'
import { InvalidConfigPathDiagnostic, DiagnosticKind } from './types'
import { isCssDoc } from '../../util/css'
import { getLanguageBoundaries } from '../../util/getLanguageBoundaries'
import { findAll, indexToPosition } from '../../util/find'
import { stringToPath } from '../../util/stringToPath'
import isObject from '../../../util/isObject'
import { closest } from '../../util/closest'
import { absoluteRange } from '../../util/absoluteRange'
const dlv = require('dlv')

export function getInvalidConfigPathDiagnostics(
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
      let suggestions: string[] = []

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
            suggestions.push(
              stitch([...keys.slice(0, keys.length - 1), closestValidKey])
            )
            message += ` Did you mean '${suggestions[0]}'?`
          }
        }
      } else {
        message = `'${match.groups.key}' was found but does not resolve to a string.`

        if (isObject(value)) {
          let validKeys = Object.keys(value).filter((key) =>
            isValid(value[key])
          )
          if (validKeys.length) {
            suggestions.push(
              ...validKeys.map((validKey) => stitch([...keys, validKey]))
            )
            message += ` Did you mean something like '${suggestions[0]}'?`
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
        suggestions,
      })
    })
  })

  return diagnostics
}
