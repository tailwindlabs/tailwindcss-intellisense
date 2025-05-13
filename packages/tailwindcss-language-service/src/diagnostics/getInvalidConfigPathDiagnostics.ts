import type { State, Settings } from '../util/state'
import { type InvalidConfigPathDiagnostic, DiagnosticKind } from './types'
import { findHelperFunctionsInDocument } from '../util/find'
import { stringToPath } from '../util/stringToPath'
import isObject from '../util/isObject'
import { closest, distance } from '../util/closest'
import { combinations } from '../util/combinations'
import { resolveKnownThemeKeys } from '../util/v4/theme-keys'
import dlv from 'dlv'
import type { TextDocument } from 'vscode-languageserver-textdocument'
import type { DesignSystem } from '../util/v4'

type ValidationResult =
  | { isValid: true; value: any }
  | { isValid: false; reason: string; suggestions: string[] }

function pathToString(path: string | string[]): string {
  if (typeof path === 'string') return path
  return path.reduce((acc, cur, i) => {
    if (i === 0) return cur
    if (cur.includes('.')) return `${acc}[${cur}]`
    return `${acc}.${cur}`
  }, '')
}

export function validateConfigPath(
  state: State,
  path: string | string[],
  base: string[] = [],
): ValidationResult {
  let keys = Array.isArray(path) ? path : stringToPath(path)

  if (state.v4) {
    return validateV4ThemePath(state, pathToString(keys))
  }

  let fullPath = [...base, ...keys]
  let value = dlv(state.config, fullPath)
  let suggestions: string[] = []

  // This property may not exist in the state object because of compatability with Tailwind Play
  let transformThemeValue =
    state.modules?.transformThemeValue?.module ?? ((_: any) => (value: any) => value)

  if (fullPath[0] === 'theme' && fullPath[1]) {
    value = transformThemeValue(fullPath[1])(value)
  }

  function findAlternativePath(): string[] {
    let points = combinations('123456789'.substr(0, keys.length - 1)).map((x) =>
      x.split('').map((x) => parseInt(x, 10)),
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

    return possibilities.find((possibility) => validateConfigPath(state, possibility, base).isValid)
  }

  if (typeof value === 'undefined') {
    let reason = `'${pathToString(path)}' does not exist in your theme config.`
    let parentPath = [...base, ...keys.slice(0, keys.length - 1)]
    let parentValue = dlv(state.config, parentPath)

    if (isObject(parentValue)) {
      let closestValidKey = closest(
        keys[keys.length - 1],
        Object.keys(parentValue).filter(
          (key) => validateConfigPath(state, [...parentPath, key]).isValid,
        ),
      )
      if (closestValidKey) {
        suggestions.push(pathToString([...keys.slice(0, keys.length - 1), closestValidKey]))
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
      Array.isArray(value) ||
      typeof value === 'function'
    )
  ) {
    let reason = `'${pathToString(path)}' was found but does not resolve to a valid theme value.`

    if (isObject(value)) {
      let validKeys = Object.keys(value).filter(
        (key) => validateConfigPath(state, [...keys, key], base).isValid,
      )
      if (validKeys.length) {
        suggestions.push(...validKeys.map((validKey) => pathToString([...keys, validKey])))
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
  settings: Settings,
): InvalidConfigPathDiagnostic[] {
  let severity = settings.tailwindCSS.lint.invalidConfigPath
  if (severity === 'ignore') return []

  let diagnostics: InvalidConfigPathDiagnostic[] = []

  findHelperFunctionsInDocument(state, document).forEach((helperFn) => {
    let base = helperFn.helper === 'theme' ? ['theme'] : []

    // var(…) may not refer to theme values but other values in the cascade
    // so they can't be unconditionally validated
    if (helperFn.helper === 'var') return

    let result = validateConfigPath(state, helperFn.path, base)

    if (result.isValid === true) {
      return
    }

    diagnostics.push({
      code: DiagnosticKind.InvalidConfigPath,
      range: helperFn.ranges.path,
      severity:
        severity === 'error'
          ? 1 /* DiagnosticSeverity.Error */
          : 2 /* DiagnosticSeverity.Warning */,
      message: result.reason,
      suggestions: result.suggestions,
    })
  })

  return diagnostics
}

function resolveThemeValue(design: DesignSystem, path: string) {
  let prefix = design.theme.prefix ?? null
  let candidate = prefix ? `${prefix}:[--custom:theme(${path})]` : `[--custom:theme(${path})]`

  // Compile a dummy candidate that uses the theme function with the given path.
  //
  // We'll get a rule with a declaration from which we read the value. No rule
  // will be generated and the root will be empty if the path is invalid.
  //
  // Non-CSS representable values are not a concern here because the validation
  // only happens for calls in a CSS context.
  let [root] = design.compile([candidate])

  let value: string | null = null

  root.walkDecls((decl) => {
    value = decl.value
  })

  return value
}

function validateV4ThemePath(state: State, path: string): ValidationResult {
  let prefix = state.designSystem.theme.prefix ?? null

  let value = resolveThemeValue(state.designSystem, path)

  if (value !== null && value !== undefined) {
    return { isValid: true, value }
  }

  let reason = path.startsWith('--')
    ? `'${path}' does not exist in your theme.`
    : `'${path}' does not exist in your theme config.`

  let suggestions = suggestAlternativeThemeKeys(state, path)

  if (suggestions.length > 0) {
    reason += ` Did you mean '${suggestions[0]}'?`
  }

  return {
    isValid: false,
    reason,
    suggestions,
  }
}

function suggestAlternativeThemeKeys(state: State, path: string): string[] {
  // Non-v4 projects don't contain CSS variable theme keys
  if (!state.v4) return []

  // v4 only supports suggesting keys currently known by the theme
  // it does not support suggesting keys from the config as that is not
  // exposed in any v4 API
  if (!path.startsWith('--')) return []

  let parts = path.slice(2).split('-')
  parts[0] = `--${parts[0]}`

  let validThemeKeys = resolveKnownThemeKeys(state.designSystem)
  let potentialThemeKey: string | null = null

  while (parts.length > 1) {
    // Slice off the end of the theme key at the `-`
    parts.pop()

    // Look at all theme keys that start with that
    let prefix = parts.join('-')

    let possibleKeys = validThemeKeys.filter((key) => key.startsWith(prefix))

    // If there are none, slice again and repeat
    if (possibleKeys.length === 0) continue

    // Find the closest match using the Fast String Distance (SIFT) algorithm
    // ensuring `--color-red-901` suggests `--color-red-900` instead of
    // `--color-red-950`. We could in theory use the algorithm directly but it
    // does not make sense to suggest keys from an unrelated namespace which is
    // why we do filtering beforehand.
    potentialThemeKey = closest(path, possibleKeys)!

    break
  }

  // If we haven't found a key based on prefix matching, we'll do one more
  // search based on the full list of available keys. This is useful if the
  // namespace itself has a typo.
  potentialThemeKey ??= closest(path, validThemeKeys)!

  // This number was chosen arbitrarily. From some light testing it seems like
  // it's a decent threshold for determine if a key is a reasonable suggestion.
  // This wasn't chosen by rigorous testing so if it needs to be adjusted it can
  // be. Chances are it'll need to be increased instead of decreased.
  const MAX_DISTANCE = 5

  return distance(path, potentialThemeKey) <= MAX_DISTANCE ? [potentialThemeKey] : []
}
