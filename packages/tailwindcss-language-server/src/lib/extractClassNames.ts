import selectorParser from 'postcss-selector-parser'
import { dset } from 'dset'
import dlv from 'dlv'
import type { Container, Node, Root, AtRule, Document } from 'postcss'

function isAtRule(node: Node): node is AtRule {
  return node.type === 'atrule'
}

function createSelectorFromNodes(nodes) {
  if (nodes.length === 0) return null
  const selector = selectorParser.selector({ value: '' })
  for (let i = 0; i < nodes.length; i++) {
    selector.append(nodes[i])
  }
  return String(selector).trim()
}

function getClassNamesFromSelector(selector: string) {
  const classNames = []
  const { nodes: subSelectors } = selectorParser().astSync(selector)

  for (let i = 0; i < subSelectors.length; i++) {
    let subSelector = subSelectors[i]
    if (subSelector.type !== 'selector') continue

    let scope = []
    for (let j = 0; j < subSelector.nodes.length; j++) {
      let node = subSelector.nodes[j]
      let pseudo = []

      if (node.type === 'class') {
        let next = subSelector.nodes[j + 1]

        while (next && next.type === 'pseudo') {
          pseudo.push(next)
          j++
          next = subSelector.nodes[j + 1]
        }

        classNames.push({
          className: node.value.trim(),
          scope: createSelectorFromNodes(scope),
          __rule: j === subSelector.nodes.length - 1,
          __pseudo: pseudo.map(String),
        })
      }
      scope.push(node, ...pseudo)
    }
  }

  return classNames
}

async function process(root: Root | Document) {
  const tree = {}
  const commonContext = {}

  let layer

  root.walk((node) => {
    if (node.type === 'comment') {
      let match = node.text.trim().match(/^__tw_intellisense_layer_([a-z]+)__$/)
      if (match === null) return
      layer = match[1]
      node.remove()
      return
    }

    if (node.type !== 'rule') return

    const rule = node
    const classNames = getClassNamesFromSelector(rule.selector)

    const decls = {}
    rule.walkDecls((decl) => {
      if (decls[decl.prop]) {
        decls[decl.prop] = [
          ...(Array.isArray(decls[decl.prop]) ? decls[decl.prop] : [decls[decl.prop]]),
          decl.value,
        ]
      } else {
        decls[decl.prop] = decl.value
      }
    })

    let p: Container | Document = rule
    const keys = []
    while (p.parent.type !== 'root') {
      p = p.parent
      if (isAtRule(p)) {
        keys.push(`@${p.name} ${p.params}`)
      }
    }

    for (let i = 0; i < classNames.length; i++) {
      const context = keys.concat([])
      const baseKeys = classNames[i].className.split(/__TWSEP__.*?__TWSEP__/)
      const contextKeys = baseKeys.slice(0, baseKeys.length - 1)
      const index = []

      const existing = dlv(tree, [...baseKeys, '__info'])
      if (typeof existing !== 'undefined') {
        if (Array.isArray(existing)) {
          index.push(existing.length)
        } else {
          dset(tree, [...baseKeys, '__info'], [existing])
          index.push(1)
        }
      }
      if (classNames[i].__rule) {
        dset(tree, [...baseKeys, '__info', ...index, '__rule'], true)

        dsetEach(tree, [...baseKeys, '__info', ...index], decls)
      }
      dset(tree, [...baseKeys, '__info', ...index, '__source'], layer)
      dset(tree, [...baseKeys, '__info', ...index, '__pseudo'], classNames[i].__pseudo)
      dset(tree, [...baseKeys, '__info', ...index, '__scope'], classNames[i].scope)
      dset(tree, [...baseKeys, '__info', ...index, '__context'], context.concat([]).reverse())

      // common context
      context.push(...classNames[i].__pseudo.map((x) => `&${x}`))

      for (let i = 0; i < contextKeys.length; i++) {
        if (typeof commonContext[contextKeys[i]] === 'undefined') {
          commonContext[contextKeys[i]] = context
        } else {
          commonContext[contextKeys[i]] = intersection(commonContext[contextKeys[i]], context)
        }
      }
    }
  })

  return { classNames: tree, context: commonContext }
}

function intersection<T>(arr1: T[], arr2: T[]): T[] {
  return arr1.filter((value) => arr2.indexOf(value) !== -1)
}

function dsetEach(obj, keys: string[], values: Record<string, string>) {
  const k = Object.keys(values)
  for (let i = 0; i < k.length; i++) {
    dset(obj, [...keys, k[i]], values[k[i]])
  }
}

export default process
