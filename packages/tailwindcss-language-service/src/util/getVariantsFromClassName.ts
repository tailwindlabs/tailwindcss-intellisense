import { State } from './state'
import * as jit from './jit'

export function getVariantsFromClassName(
  state: State,
  className: string
): { variants: string[]; offset: number } {
  let allVariants = Object.keys(state.variants)
  let parts = Array.from(splitAtTopLevelOnly(className, state.separator)).filter(Boolean)
  let variants = new Set<string>()
  let offset = 0

  for (let part of parts) {
    if (
      allVariants.includes(part) ||
      (state.jit &&
        ((part.includes('[') && part.endsWith(']')) ||
          (part.includes('<') && part.includes('>'))) &&
        jit.generateRules(state, [`${part}${state.separator}[color:red]`]).rules.length > 0)
    ) {
      variants.add(part)
      offset += part.length + state.separator.length
      continue
    }

    break
  }

  return { variants: Array.from(variants), offset }
}

const REGEX_SPECIAL = /[\\^$.*+?()[\]{}|]/g
const REGEX_HAS_SPECIAL = RegExp(REGEX_SPECIAL.source)

function regexEscape(string: string): string {
  return string && REGEX_HAS_SPECIAL.test(string)
    ? string.replace(REGEX_SPECIAL, '\\$&')
    : string || ''
}

function* splitAtTopLevelOnly(input: string, separator: string): Generator<string> {
  let SPECIALS = new RegExp(`[(){}\\[\\]${regexEscape(separator)}]`, 'g')

  let depth = 0
  let lastIndex = 0
  let found = false
  let separatorIndex = 0
  let separatorStart = 0
  let separatorLength = separator.length

  // Find all paren-like things & character
  // And only split on commas if they're top-level
  for (let match of input.matchAll(SPECIALS)) {
    let matchesSeparator = match[0] === separator[separatorIndex]
    let atEndOfSeparator = separatorIndex === separatorLength - 1
    let matchesFullSeparator = matchesSeparator && atEndOfSeparator

    if (match[0] === '(') depth++
    if (match[0] === ')') depth--
    if (match[0] === '[') depth++
    if (match[0] === ']') depth--
    if (match[0] === '{') depth++
    if (match[0] === '}') depth--

    if (matchesSeparator && depth === 0) {
      if (separatorStart === 0) {
        separatorStart = match.index
      }

      separatorIndex++
    }

    if (matchesFullSeparator && depth === 0) {
      found = true

      yield input.substring(lastIndex, separatorStart)
      lastIndex = separatorStart + separatorLength
    }

    if (separatorIndex === separatorLength) {
      separatorIndex = 0
      separatorStart = 0
    }
  }

  // Provide the last segment of the string if available
  // Otherwise the whole string since no `char`s were found
  // This mirrors the behavior of string.split()
  if (found) {
    yield input.substring(lastIndex)
  } else {
    yield input
  }
}
