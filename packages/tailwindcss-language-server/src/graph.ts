/**
 * Represents a dependency graph
 */
export class Graph<T> {
  /**
   * A list of all direct ancestors for each node
   */
  private parents: Map<string, Set<string>> = new Map()

  /**
   * A list of all direct descendants for each node
   */
  private children: Map<string, Set<string>> = new Map()

  /**
   * A list of all direct descendants for each node
   */
  private nodes: Map<string, T> = new Map()

  add(id: string, value: T): T {
    if (this.nodes.has(id)) {
      return this.nodes.get(id)
    }

    this.nodes.set(id, value)
    this.parents.set(id, new Set())
    this.children.set(id, new Set())

    return value
  }

  /**
   * Connect two nodes to each other
   */
  connect(from: string, to: string) {
    let children = this.children.get(from)
    if (!children) throw new Error(`Node ${from} does not exist`)

    let parents = this.parents.get(to)
    if (!parents) throw new Error(`Node ${to} does not exist`)

    parents.add(from)
    children.add(to)
  }

  *descendants(id: string): Iterable<T> {
    let q: string[] = []
    let seen: Set<string> = new Set()

    for (let child of this.children.get(id)) {
      q.push(child)
    }

    while (q.length > 0) {
      let current = q.shift()!
      if (seen.has(current)) continue
      yield this.nodes.get(current)
      seen.add(current)
      for (let child of this.children.get(current)) {
        q.push(child)
      }
    }
  }

  /**
   * A list of all root nodes in the graph
   * (meaning they have no parents)
   */
  *roots(): Iterable<T> {
    for (let [id, parents] of this.parents) {
      if (parents.size !== 0) continue
      yield this.nodes.get(id)
    }
  }

  /**
   * A list of all leaf nodes in the graph
   * (meaning they have no children)
   */
  *leaves(): Iterable<T> {
    for (let [id, children] of this.children) {
      if (children.size !== 0) continue
      yield this.nodes.get(id)
    }
  }
}
