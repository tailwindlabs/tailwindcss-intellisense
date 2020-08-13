import { dirname } from 'path'
import { resolveConfig } from '../class-names/index'
const dlv = require('dlv')
import * as crypto from 'crypto'
import * as BabelTypes from '@babel/types'
import { Visitor, NodePath } from '@babel/traverse'
import isObject from '../util/isObject'
require('@babel/register').default({
  plugins: [plugin],
  cache: false,
  babelrc: false,
  ignore: [
    (filepath: string) => {
      if (/node_modules\/@?tailwind/.test(filepath)) return false
      return /node_modules/.test(filepath)
    },
  ],
})

const LOCATION_PROP = '__twlsp_locations__'

interface PluginOptions {
  file: {
    opts: {
      filename: string
    }
  }
}

process.on('message', ([configPath, key]: [string, string[]]) => {
  let config
  try {
    // @ts-ignore
    config = resolveConfig({
      cwd: dirname(configPath),
      config: configPath,
    })
  } catch (_) {
    return process.send({ key })
  }

  let parent = dlv(config, key.slice(0, key.length - 1))

  if (isObject(parent)) {
    let location: [string, number, number, number, number]
    for (let k in parent) {
      if (k.startsWith(LOCATION_PROP) && parent[k][key[key.length - 1]]) {
        location = parent[k][key[key.length - 1]]
      }
    }
    if (location) {
      process.send({
        key,
        file: location[0],
        range: {
          start: { line: location[1], character: location[2] },
          end: { line: location[3], character: location[4] },
        },
      })
      return
    }
  }

  process.send({ key })
})

function isObjectPropertyPath(
  path: NodePath<any>,
  t: typeof BabelTypes
): path is NodePath<BabelTypes.ObjectProperty> {
  return t.isObjectProperty(path)
}

function plugin({
  types: t,
}: {
  types: typeof BabelTypes
}): { visitor: Visitor<PluginOptions> } {
  const objVisitor: Visitor<PluginOptions> = {
    ObjectExpression(path, state) {
      if (
        isObjectPropertyPath(path.parentPath, t) &&
        path.parentPath.node.key.name.startsWith(LOCATION_PROP)
      ) {
        return
      }
      let props = path.node.properties
        .filter(
          (x): x is BabelTypes.ObjectProperty => x.type === 'ObjectProperty'
        )
        .map((prop) => {
          return t.objectProperty(
            prop.key,
            t.arrayExpression([
              t.stringLiteral(state.file.opts.filename),
              t.numericLiteral(prop.key.loc.start.line - 1),
              t.numericLiteral(prop.key.loc.start.column),
              t.numericLiteral(prop.key.loc.end.line - 1),
              t.numericLiteral(prop.key.loc.end.column),
            ]),
            prop.computed
          )
        })
      if (props.length === 0) return
      path.unshiftContainer(
        'properties',
        t.objectProperty(
          t.identifier(LOCATION_PROP + crypto.randomBytes(16).toString('hex')),
          t.objectExpression(props)
        )
      )
    },
  }

  return {
    visitor: {
      Program(path, state) {
        path.traverse(objVisitor, {
          file: {
            opts: {
              filename: state.file.opts.filename,
            },
          },
        })
      },
    },
  }
}
