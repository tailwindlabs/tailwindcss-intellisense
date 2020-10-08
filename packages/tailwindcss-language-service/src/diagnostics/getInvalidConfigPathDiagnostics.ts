import { State, Settings } from '../util/state'
import type { TextDocument, Range, DiagnosticSeverity } from 'vscode-languageserver'
import { InvalidConfigPathDiagnostic, DiagnosticKind } from './types'
import { isCssDoc } from '../util/css'
import { getLanguageBoundaries } from '../util/getLanguageBoundaries'
import { findAll, indexToPosition } from '../util/find'
import { stringToPath } from '../util/stringToPath'
import isObject from '../util/isObject'
import { closest } from '../util/closest'
import { absoluteRange } from '../util/absoluteRange'
import { combinations } from '../util/combinations'
const dlv = require('dlv')

function pathToString(path: string | string[]): string {
  if (typeof path === 'string') return path
  return path.reduce((acc, cur, i) => {
    if (i === 0) return cur
    if (cur.includes('.')) return `${acc}[${cur}]`
    return `${acc}.${cur}`
  }, '')
}

function validateConfigPath(
  state: State,
  path: string | string[],
  base: string[] = []
):
  | { isValid: true; value: any }
  | { isValid: false; reason: string; suggestions: string[] } {
  let keys = Array.isArray(path) ? path : stringToPath(path)
  let value = dlv(state.config, [...base, ...keys])
  let suggestions: string[] = []

  function findAlternativePath(): string[] {
    let points = combinations('123456789'.substr(0, keys.length - 1)).map((x) =>
      x.split('').map((x) => parseInt(x, 10))
    )

    let possibilities: string[][] = points
      .map((p) => {
        let result = []
        let i = 0
        p.forEach((x) => {
          result.push(keys.slice(i, x).join('.'))
          i = x
        })
        result.push(keys.slice(i).join('.'))
        return result
      })
      .slice(1) // skip original path

    return possibilities.find(
      (possibility) => validateConfigPath(state, possibility, base).isValid
    )
  }

  if (typeof value === 'undefined') {
    let reason = `'${pathToString(path)}' does not exist in your theme config.`
    let parentPath = [...base, ...keys.slice(0, keys.length - 1)]
    let parentValue = dlv(state.config, parentPath)

    if (isObject(parentValue)) {
      let closestValidKey = closest(
        keys[keys.length - 1],
        Object.keys(parentValue).filter(
          (key) => validateConfigPath(state, [...parentPath, key]).isValid
        )
      )
      if (closestValidKey) {
        suggestions.push(
          pathToString([...keys.slice(0, keys.length - 1), closestValidKey])
        )
        reason += ` Did you mean '${suggestions[0]}'?`
      }
    } else {
      let altPath = findAlternativePath()
      if (altPath) {
        return {
          isValid: false,
          reason: `${reason} Did you mean '${pathToString(altPath)}'?`,
          suggestions: [pathToString(altPath)],
        }
      }
    }

    return {
      isValid: false,
      reason,
      suggestions,
    }
  }

  if (
    !(
      typeof value === 'string' ||
      typeof value === 'number' ||
      value instanceof String ||
      value instanceof Number ||
      Array.isArray(value)
    )
  ) {
    let reason = `'${pathToString(
      path
    )}' was found but does not resolve to a string.`

    if (isObject(value)) {
      let validKeys = Object.keys(value).filter(
        (key) => validateConfigPath(state, [...keys, key], base).isValid
      )
      if (validKeys.length) {
        suggestions.push(
          ...validKeys.map((validKey) => pathToString([...keys, validKey]))
        )
        reason += ` Did you mean something like '${suggestions[0]}'?`
      }
    }
    return {
      isValid: false,
      reason,
      suggestions,
    }
  }

  // The value resolves successfully, but we need to check that there
  // wasn't any funny business. If you have a theme object:
  // { msg: 'hello' } and do theme('msg.0')
  // this will resolve to 'h', which is probably not intentional, so we
  // check that all of the keys are object or array keys (i.e. not string
  // indexes)
  let isValid = true
  for (let i = keys.length - 1; i >= 0; i--) {
    let key = keys[i]
    let parentValue = dlv(state.config, [...base, ...keys.slice(0, i)])
    if (/^[0-9]+$/.test(key)) {
      if (!isObject(parentValue) && !Array.isArray(parentValue)) {
        isValid = false
        break
      }
    } else if (!isObject(parentValue)) {
      isValid = false
      break
    }
  }
  if (!isValid) {
    let reason = `'${pathToString(path)}' does not exist in your theme config.`

    let altPath = findAlternativePath()
    if (altPath) {
      return {
        isValid: false,
        reason: `${reason} Did you mean '${pathToString(altPath)}'?`,
        suggestions: [pathToString(altPath)],
      }
    }

    return {
      isValid: false,
      reason,
      suggestions: [],
    }
  }

  return {
    isValid: true,
    value,
  }
}

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
      let result = validateConfigPath(state, match.groups.key, base)

      if (result.isValid === true) {
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
            ? 1 /* DiagnosticSeverity.Error */
            : 2 /* DiagnosticSeverity.Warning */,
        message: result.reason,
        suggestions: result.suggestions,
      })
    })
  })

  return diagnostics
}
