import { test, expect } from 'vitest'
import { Graph } from './graph'

function buildGraph() {
  let graph = new Graph<string>()
  graph.add('A', 'a')
  graph.add('B', 'b')
  graph.add('C', 'c')
  graph.add('D', 'd')
  graph.add('E', 'e')
  graph.add('F', 'f')
  graph.add('G', 'g')

  // A -> B -> {D,E}
  graph.connect('A', 'B')
  graph.connect('B', 'D')
  graph.connect('B', 'E')

  // A -> C -> F
  graph.connect('A', 'C')
  graph.connect('C', 'F')

  // B -> C (-> F, implied)
  graph.connect('B', 'C')

  return graph
}

test('graph#add returns existing nodes', () => {
  let a1 = { foo: 'bar' }
  let a2 = { foo: 'baz' }

  let graph1 = new Graph<object>()
  expect(graph1.add('A', a1)).toBe(a1)
  expect(graph1.add('A', a2)).toBe(a1)

  let graph2 = new Graph<object>()
  expect(graph2.add('A', a2)).toBe(a2)
  expect(graph2.add('A', a1)).toBe(a2)
})

test('graph#connect with nodes that do not exist', () => {
  expect(() => {
    let graph = new Graph<string>()
    graph.connect('A', 'B')
  }).toThrowErrorMatchingInlineSnapshot(`[Error: Node A does not exist]`)

  expect(() => {
    let graph = new Graph<string>()
    graph.add('A', 'a')
    graph.connect('A', 'B')
  }).toThrowErrorMatchingInlineSnapshot(`[Error: Node B does not exist]`)

  expect(() => {
    let graph = new Graph<string>()
    graph.add('A', 'a')
    graph.add('B', 'b')
    graph.connect('A', 'B')
  }).not.toThrow()
})

test('graph#roots', () => {
  let result = Array.from(buildGraph().roots())

  expect(result).toMatchInlineSnapshot(`
    [
      "a",
      "g",
    ]
  `)
})

test('graph#leaves', () => {
  let result = Array.from(buildGraph().leaves())

  expect(result).toMatchInlineSnapshot(`
    [
      "d",
      "e",
      "f",
      "g",
    ]
  `)
})

test('graph#descendants', () => {
  let result = [
    Array.from(buildGraph().descendants('A')),
    Array.from(buildGraph().descendants('B')),
    Array.from(buildGraph().descendants('C')),
    Array.from(buildGraph().descendants('D')),
  ]

  expect(result).toMatchInlineSnapshot(`
    [
      [
        "b",
        "c",
        "d",
        "e",
        "f",
      ],
      [
        "d",
        "e",
        "c",
        "f",
      ],
      [
        "f",
      ],
      [],
    ]
  `)
})
