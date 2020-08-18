import { dirname } from 'path'
import { resolveConfig } from '../class-names/index'
import * as crypto from 'crypto'
import * as BabelTypes from '@babel/types'
import { Visitor, NodePath } from '@babel/traverse'
require('@babel/register').default({
  plugins: [plugin],
  cache: false,
  babelrc: false,
  ignore: [
    (filename: string) => {
      if (/node_modules\/@?tailwind/.test(filename)) return false
      return /node_modules/.test(filename)
    },
  ],
})

const LOCATION_PROP_PREFIX = '__twlsp_locations__'

interface PluginOptions {
  file: {
    opts: {
      filename: string
    }
  }
}

process.on('message', ([id, configPath]: [number, string, string[]]) => {
  let config: any
  try {
    // @ts-ignore
    config = resolveConfig({
      cwd: dirname(configPath),
      config: configPath,
    })
  } catch (_) {
    return process.send({ id, error: 'Couldn’t generate locations' })
  }

  process.send({ id, config })
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
        path.parentPath.node.key.name &&
        path.parentPath.node.key.name.startsWith(LOCATION_PROP_PREFIX)
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
          t.identifier(
            LOCATION_PROP_PREFIX + crypto.randomBytes(16).toString('hex')
          ),
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
