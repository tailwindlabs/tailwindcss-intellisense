import * as crypto from 'crypto'
import * as BabelTypes from '@babel/types'
import { Visitor, NodePath } from '@babel/traverse'
import { dirname } from 'path'
import { resolveConfig } from '../../class-names'
const babel = require('@babel/register')
babel.revert()

const LOCATION_PROP_PREFIX = '__twlsp_locations__'

interface PluginOptions {
  file: {
    opts: {
      filename: string
    }
  }
}

export default function getConfigWithLocations(
  configPath: string
): { config: any } {
  babel.default({
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

  let config

  try {
    // @ts-ignore
    config = resolveConfig({
      cwd: dirname(configPath),
      config: configPath,
    })
  } finally {
    babel.revert()
  }

  return { config }
}

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
        t.isIdentifier(path.parentPath.node.key) &&
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
