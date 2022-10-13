import { State } from './state'
import * as jit from './jit'

export function getVariantsFromClassName(
  state: State,
  className: string
): { variants: string[]; offset: number } {
  let allVariants = Object.keys(state.variants)
  let parts = splitAtTopLevelOnly(className, state.separator).filter(Boolean)
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

// https://github.com/tailwindlabs/tailwindcss/blob/a8a2e2a7191fbd4bee044523aecbade5823a8664/src/util/splitAtTopLevelOnly.js
function splitAtTopLevelOnly(input: string, separator: string): string[] {
  let stack: string[] = []
  let parts: string[] = []
  let lastPos = 0

  for (let idx = 0; idx < input.length; idx++) {
    let char = input[idx]

    if (stack.length === 0 && char === separator[0]) {
      if (separator.length === 1 || input.slice(idx, idx + separator.length) === separator) {
        parts.push(input.slice(lastPos, idx))
        lastPos = idx + separator.length
      }
    }

    if (char === '(' || char === '[' || char === '{') {
      stack.push(char)
    } else if (
      (char === ')' && stack[stack.length - 1] === '(') ||
      (char === ']' && stack[stack.length - 1] === '[') ||
      (char === '}' && stack[stack.length - 1] === '{')
    ) {
      stack.pop()
    }
  }

  parts.push(input.slice(lastPos))

  return parts
}
