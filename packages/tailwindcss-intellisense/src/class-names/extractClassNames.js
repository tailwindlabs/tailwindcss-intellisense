import selectorParser from 'postcss-selector-parser'
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
          __pseudo: pseudo.map(String),
        })
      }
      scope.push(node, ...pseudo)
    }
  }

  return classNames
}

async function process(groups) {
  const tree = {}
  const commonContext = {}

  groups.forEach((group) => {
    group.root.walkRules((rule) => {
      const classNames = getClassNamesFromSelector(rule.selector)

      const decls = {}
      rule.walkDecls((decl) => {
        if (decls[decl.prop]) {
          decls[decl.prop] = [
            ...(Array.isArray(decls[decl.prop])
              ? decls[decl.prop]
              : [decls[decl.prop]]),
            decl.value,
          ]
        } else {
          decls[decl.prop] = decl.value
        }
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
          dset(
            tree,
            [...baseKeys, '__info', ...index, '__source'],
            group.source
          )

          dsetEach(tree, [...baseKeys, '__info', ...index], decls)
        }
        dset(
          tree,
          [...baseKeys, '__info', ...index, '__pseudo'],
          classNames[i].__pseudo
        )
        dset(
          tree,
          [...baseKeys, '__info', ...index, '__scope'],
          classNames[i].scope
        )
        dset(
          tree,
          [...baseKeys, '__info', ...index, '__context'],
          context.concat([]).reverse()
        )

        // common context
        context.push(...classNames[i].__pseudo.map((x) => `&${x}`))

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
