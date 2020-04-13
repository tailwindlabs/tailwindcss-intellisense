import selectorParser from 'postcss-selector-parser'
import fs from 'fs'
import path from 'path'
import dset from 'dset'
import dlv from 'dlv'

function createSelectorFromNodes(nodes) {
  if (nodes.length === 0) return null
  const selector = selectorParser.selector()
  for (let i = 0; i < nodes.length; i++) {
    selector.append(nodes[i])
  }
  return String(selector).trim()
}

function getClassNamesFromSelector(selector) {
  const classNames = []
  const { nodes: subSelectors } = selectorParser().astSync(selector)

  for (let i = 0; i < subSelectors.length; i++) {
    let scope = []
    for (let j = 0; j < subSelectors[i].nodes.length; j++) {
      let node = subSelectors[i].nodes[j]
      let pseudo = []

      if (node.type === 'class') {
        let next = subSelectors[i].nodes[j + 1]

        while (next && next.type === 'pseudo') {
          pseudo.push(next)
          j++
          next = subSelectors[i].nodes[j + 1]
        }

        classNames.push({
          className: node.value.trim(),
          scope: createSelectorFromNodes(scope),
          __rule: j === subSelectors[i].nodes.length - 1,
          __pseudo: pseudo.length === 0 ? null : pseudo.map(String),
        })
      }
      scope.push(node, ...pseudo)
    }
  }

  return classNames
}

async function process(ast) {
  const tree = {}
  const commonContext = {}

  ast.root.walkRules((rule) => {
    const classNames = getClassNamesFromSelector(rule.selector)

    const decls = {}
    rule.walkDecls((decl) => {
      decls[decl.prop] = decl.value
    })

    let p = rule
    const keys = []
    while (p.parent.type !== 'root') {
      p = p.parent
      if (p.type === 'atrule') {
        keys.push(`@${p.name} ${p.params}`)
      }
    }

    for (let i = 0; i < classNames.length; i++) {
      const context = keys.concat([])
      const baseKeys = classNames[i].className.split('__TAILWIND_SEPARATOR__')
      const contextKeys = baseKeys.slice(0, baseKeys.length - 1)
      const index = []

      const existing = dlv(tree, baseKeys)
      if (typeof existing !== 'undefined') {
        if (Array.isArray(existing)) {
          const scopeIndex = existing.findIndex(
            (x) =>
              x.__scope === classNames[i].scope &&
              arraysEqual(existing.__context, context)
          )
          if (scopeIndex > -1) {
            keys.unshift(scopeIndex)
            index.push(scopeIndex)
          } else {
            keys.unshift(existing.length)
            index.push(existing.length)
          }
        } else {
          if (
            existing.__scope !== classNames[i].scope ||
            !arraysEqual(existing.__context, context)
          ) {
            dset(tree, baseKeys, [existing])
            keys.unshift(1)
            index.push(1)
          }
        }
      }
      if (classNames[i].__rule) {
        dset(tree, [...baseKeys, ...index, '__rule'], true)

        dsetEach(tree, [...baseKeys, ...index], decls)
      }
      if (classNames[i].__pseudo) {
        dset(tree, [...baseKeys, '__pseudo'], classNames[i].__pseudo)
      }
      dset(tree, [...baseKeys, ...index, '__scope'], classNames[i].scope)
      dset(
        tree,
        [...baseKeys, ...index, '__context'],
        context.concat([]).reverse()
      )

      // common context
      if (classNames[i].__pseudo) {
        context.push(...classNames[i].__pseudo)
      }

      for (let i = 0; i < contextKeys.length; i++) {
        if (typeof commonContext[contextKeys[i]] === 'undefined') {
          commonContext[contextKeys[i]] = context
        } else {
          commonContext[contextKeys[i]] = intersection(
            commonContext[contextKeys[i]],
            context
          )
        }
      }
    }
  })

  return { classNames: tree, context: commonContext }
}

function intersection(arr1, arr2) {
  return arr1.filter((value) => arr2.indexOf(value) !== -1)
}

function dsetEach(obj, keys, values) {
  const k = Object.keys(values)
  for (let i = 0; i < k.length; i++) {
    dset(obj, [...keys, k[i]], values[k[i]])
  }
}

function arraysEqual(a, b) {
  if (a === b) return true
  if (a == null || b == null) return false
  if (a.length !== b.length) return false

  for (let i = 0; i < a.length; ++i) {
    if (a[i] !== b[i]) return false
  }
  return true
}

export default process
