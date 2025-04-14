import { stringify, tokenize } from '@csstools/css-tokenizer'
import { isFunctionNode, parseComponentValue } from '@csstools/css-parser-algorithms'
import { calcFromComponentValues } from '@csstools/css-calc'

export function evaluateExpression(str: string): string | null {
  let tokens = tokenize({ css: `calc(${str})` })

  let components = parseComponentValue(tokens, {})
  if (!components) return null

  let result = calcFromComponentValues([[components]], {
    // Ensure evaluation of random() is deterministic
    randomSeed: 1,

    // Limit precision to keep values environment independent
    precision: 4,
  })

  // The result array is the same shape as the original so we're guaranteed to
  // have an element here
  let node = result[0][0]

  // If we have a top-level `calc(…)` node then the evaluation did not resolve
  // to a single value and we consider it to be incomplete
  if (isFunctionNode(node)) {
    if (node.name[1] === 'calc(') return null
  }

  return stringify(...node.tokens())
}
