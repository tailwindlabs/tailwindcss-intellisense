import braces from 'braces'

type RootNode = {
  type: 'root'
  input: string
  nodes: Node[]
}

type BraceNode = {
  type: 'brace'
  nodes: Node[]
  ranges: number
}

type Node =
  | RootNode
  | { type: 'bos' }
  | { type: 'comma' }
  | BraceNode
  | { type: 'range'; value: string }
  | { type: 'text'; value: string }
  | { type: 'eos' }

function parse(pattern: string): RootNode {
  // @ts-ignore
  return braces.parse(pattern) as RootNode
}

function count(node: RootNode | BraceNode): bigint {
  let size = 1n

  if (node.type === 'brace') {
    if (node.ranges > 0) {
      let min = null
      let max = null
      let step = null

      for (let child of node.nodes) {
        if (child.type === 'text') {
          if (min === null) {
            min = Number(child.value)
          } else if (max === null) {
            max = Number(child.value)
          } else if (step === null) {
            step = Number(child.value)
          }
        }
      }

      if (step === null) step = 1

      if (Number.isInteger(min) && Number.isInteger(max) && Number.isInteger(step)) {
        size += BigInt(Math.floor((max - min) / step))
      } else {
        size += 1n
      }
    }

    // Each segment adds a combination at this depth
    for (let child of node.nodes) {
      size += child.type === 'comma' ? 1n : 0n
    }

    // Nested braces multiply the size at this depth by the number of combinations inside the brace
    for (let child of node.nodes) {
      size *= child.type === 'brace' ? count(child) : 1n
    }
  } else if (node.type === 'root') {
    for (let child of node.nodes) {
      size *= child.type === 'brace' ? count(child) : 1n
    }
  }

  return size
}

export function expandSize(pattern: string): bigint {
  return count(parse(pattern))
}

export { braces }
