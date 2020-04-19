import { parse } from '@babel/parser'
require('@babel/register').default({
  plugins: [plugin],
  cache: false,
  babelrc: false,
  ignore: [
    function (filepath: string) {
      if (/node_modules\/@?tailwind/.test(filepath)) return false
      return /node_modules/.test(filepath)
    },
  ],
})

const FN_NAME = '__twcls_extend__'
const PROP_NAME = '__twcls_location__'

const extendFn = parse(`
  function ${FN_NAME}(val, loc) {
    if (typeof val === 'string') {
      return Object.defineProperty(new String(val), '${PROP_NAME}', {
        value: loc
      })
    }
    if (typeof val === 'number') {
      return Object.defineProperty(new Number(val), '${PROP_NAME}', {
        value: loc
      })
    }
    if (typeof val === 'boolean') {
      return Object.defineProperty(new Boolean(val), '${PROP_NAME}', {
        value: loc
      })
    }
    if (typeof val === 'object') {
      if (val.hasOwnProperty('${PROP_NAME}')) return val
      return Object.defineProperty(val, '${PROP_NAME}', {
        value: loc
      })
    }
    return val
  }
`).program.body[0]

const dlv = require('dlv')
import { resolveConfig } from 'tailwindcss-class-names'

process.on('message', ([configPath, requestedKey]: [string, string[]]) => {
  let config
  try {
    config = resolveConfig({
      config: configPath,
    })
  } catch (_) {
    return process.send({ key: requestedKey })
  }

  let key: string[][]
  if (Array.isArray(requestedKey[0])) {
    key = requestedKey[0].map((k) => {
      return [k].concat(requestedKey.slice(1))
    })
  } else {
    key = [requestedKey]
  }
  for (var i = 0; i < key.length; i++) {
    var k = key[i]
    var value = dlv(config, k, dlv(config, ['theme'].concat(k)))
    if (typeof value === 'undefined') {
      var parts = k[k.length - 1].split('-')
      if (parts.length === 2) {
        k = k.slice(0, k.length - 1).concat(parts)
        value = dlv(config, k, dlv(config, ['theme'].concat(k)))
      }
    }
    if (typeof value !== 'undefined') break
  }
  if (typeof value === 'object' && Array.isArray(value[PROP_NAME])) {
    var pos = value[PROP_NAME]
    if (Array.isArray(pos) && pos.length === 5) {
      process.send({
        key: requestedKey,
        file: pos[0],
        range: {
          start: { line: pos[1], character: pos[2] },
          end: { line: pos[3], character: pos[4] },
        },
      })
    } else {
      process.send({ key: requestedKey })
    }
  } else {
    process.send({ key: requestedKey })
  }
})

function plugin(babel) {
  let { types: t } = babel

  const propVisitor = {
    ObjectProperty(path) {
      if (!t.isObjectExpression(path.parent)) return

      let value = path.get('value')
      if (t.isCallExpression(value.node)) {
        if (value.node.callee.name === this.fn.name) return
      }
      value.replaceWith(
        t.callExpression(this.fn, [
          t.cloneNode(value.node),
          t.arrayExpression([
            t.stringLiteral(this.filename),
            t.numericLiteral(value.node.loc.start.line - 1),
            t.numericLiteral(value.node.loc.start.column),
            t.numericLiteral(value.node.loc.end.line - 1),
            t.numericLiteral(value.node.loc.end.column),
          ]),
        ])
      )
    },
  }

  return {
    visitor: {
      Program(path, state) {
        path.traverse(propVisitor, {
          fn: t.identifier(FN_NAME),
          filename: state.file.opts.filename,
        })
        path.unshiftContainer('body', extendFn)
      },
    },
  }
}
