import { isTokenFunction } from '@csstools/css-tokenizer'
import { CSSToken } from '@csstools/css-tokenizer'
import { isTokenCloseParen } from '@csstools/css-tokenizer'
import { isTokenEOF } from '@csstools/css-tokenizer'
import { TokenFunction } from '@csstools/css-tokenizer'
import { TokenIdent } from '@csstools/css-tokenizer'
import { isTokenIdent } from '@csstools/css-tokenizer'
import { isTokenComma } from '@csstools/css-tokenizer'
import { DefaultMap } from '../default-map'
import { createCssSyntax, CssSyntax } from './syntax'
import { topologicalSort } from './topological-sort'
import { ComponentValue } from '@csstools/css-parser-algorithms'

export type AnyNode = OtherNode | FunctionNode

export interface OtherNode {
  kind: 'other'
  tokens: CSSToken[]
}

export interface FunctionNode {
  kind: 'fn'
  start: TokenFunction
  end: CSSToken | undefined
  name: TokenIdent | undefined
  fallback: AnyNode[]
}

/**
 * Parse a sequence of tokens into nodes that represent:
 * - CSS variables references (var(…), theme(…), etc…)
 * - Everything else
 */
export function parse(tokens: CSSToken[]): {
  nodes: AnyNode[]
  refs: FunctionNode[]
} {
  interface Frame {
    start?: TokenFunction
    value: AnyNode[]
    name?: TokenIdent
    comma: boolean
  }

  let refs: FunctionNode[] = []

  let root: Frame = { value: [], comma: false }
  let stack: Frame[] = [root]

  let i = 0

  while (true) {
    let t = tokens[i]

    // End of input -> close all open functions
    if (!t || isTokenEOF(t)) {
      if (stack.length === 1) {
        return {
          nodes: root.value,
          refs,
        }
      }

      let frame = stack.pop()!

      let node: FunctionNode = {
        kind: 'fn',
        start: frame.start!,
        end: t,
        name: frame.name,
        fallback: frame.value,
      }

      refs.push(node)
      stack[stack.length - 1].value.push(node)

      continue
    }

    // Start of a function -> push new frame
    if (isVariableFunction(t)) {
      stack.push({ start: t, value: [], comma: false })
    }

    // Close of a function -> pop and append to previous frame
    else if (isTokenCloseParen(t) && stack.length > 1) {
      let frame = stack.pop()!
      let node: FunctionNode = {
        kind: 'fn',
        start: frame.start!,
        end: t,
        name: frame.name,
        fallback: frame.value,
      }

      refs.push(node)
      stack[stack.length - 1].value.push(node)
    }

    // Plain tokens
    else {
      let frame = stack[stack.length - 1]

      // Make sure there's an ident before a comma inside a var(…) function
      // otherwise it's invalid
      if (frame.start) {
        if (isTokenIdent(t) && !frame.name && !frame.comma) {
          frame.name = t as TokenIdent
          i += 1
          continue
        } else if (isTokenComma(t)) {
          frame.comma = true
        }
      }

      let arr = frame.value
      let last = arr[arr.length - 1]
      if (last && last.kind === 'other') {
        last.tokens.push(t)
      } else {
        arr.push({ kind: 'other', tokens: [t] })
      }
    }

    i += 1
  }
}

export function computeSubstitutions(
  css: CssSyntax,
  vars: Map<string, string>,
): {
  variables: Map<string, ComponentValue[]>
  cyclic: Set<string>
} {
  //
  // Step 1: Tokenize all known variables
  //
  vars.set('--tw-text-shadow-alpha', '100%')
  vars.set('--tw-drop-shadow-alpha', '100%')
  vars.set('--tw-shadow-alpha', '100%')

  let list = new Map<string, CSSToken[]>()
  for (let [name, value] of vars) list.set(name, css.tokens(value))

  //
  // Step 2: Build dependency graph of variable references
  //
  let dependencies = new Map<string, Set<string>>()
  let locations = new DefaultMap<string, { tokens: CSSToken[]; node: FunctionNode }[]>(() => [])

  for (let [root, tokens] of list) {
    let deps = new Set<string>()

    let { refs } = parse(tokens)

    for (let node of refs) {
      let name = node.name?.[1]
      if (!name) continue

      deps.add(name)
      locations.get(name).push({ tokens, node })
    }

    dependencies.set(root, deps)
  }

  // Make sure every seen variable has a recorded dependency set
  for (let deps of dependencies.values()) {
    for (let dep of deps) {
      if (dependencies.get(dep)) continue
      dependencies.set(dep, new Set())
    }
  }

  //
  // Step 3: Topological sort all known variables
  //
  // This will allow us to:
  // - Identify and skip self-referential variables
  // - Perform variable substitutions of dependencies first
  //
  let cyclic = new Set<string>()
  let sorted = topologicalSort(dependencies, {
    onCircularDependency: (path) => {
      for (let name of path) {
        cyclic.add(name)
      }
    },
  })

  //
  // Step 4: Variable substitution
  //
  for (let name of sorted) {
    for (let { tokens, node } of locations.get(name)) {
      let start = tokens.indexOf(node.start)
      let end = node.end ? tokens.indexOf(node.end) : tokens.length

      // This doesn't exist in the list
      // This shouldn't actually happen, right?
      if (start === -1 || end === -1) continue

      // If we don't know the value of this variable, or it's value is cyclic
      // then we'll need to replace it with the fallback if one is available
      let value = list.get(name)
      if (!value || cyclic.has(name)) {
        // No fallback available
        if (node.fallback.length === 0) continue

        // TODO: Need a test to verify this happens recursively
        let r = node.fallback.flatMap(tokensIn)

        // TODO: This shouldn't happen, can we validate this?
        if (!isTokenComma(r[0])) continue

        value = r.slice(1)
      }

      tokens.splice(start, end - start + 1, ...(value ?? []))
    }
  }

  // Temp fix:
  for (let [name, tokens] of list) list.set(name, css.tokens(css.tokensToString(tokens)))

  // let tokens = list.get('--known') ?? []

  // console.log('tokens:     ', css.tokensToString(tokens))
  // console.log('components: ', css.componentsToString(css.componentsFromTokens(tokens)))

  // console.log('reparse tokens...')
  // tokens = css.tokens(css.tokensToString(tokens))

  // console.log('tokens:     ', css.tokensToString(tokens))
  // console.log('components: ', css.componentsToString(css.componentsFromTokens(tokens)))

  //
  // Step 5: Parsing all variables values
  //
  let parsed = new Map<string, ComponentValue[]>()
  for (let [name, tokens] of list) parsed.set(name, css.componentsFromTokens(tokens))

  return { variables: parsed, cyclic }
}

function isVariableFunction(t: CSSToken): t is TokenFunction {
  return isTokenFunction(t) && (t[1] === 'var(' || t[1] === 'theme(' || t[1] === '--theme(')
}

function tokensIn(node: AnyNode): CSSToken[] {
  if (node.kind === 'other') {
    return node.tokens
  }

  if (node.kind === 'fn') {
    return [node.start, node.name, ...node.fallback.flatMap(tokensIn), node.end]
  }

  return []
}
