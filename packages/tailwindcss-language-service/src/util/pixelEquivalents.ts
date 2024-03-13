import type { Plugin } from 'postcss'
import parseValue from 'postcss-value-parser'
import { parse as parseMediaQueryList } from '@csstools/media-query-list-parser'
import postcss from 'postcss'
import { isTokenNode } from '@csstools/css-parser-algorithms'
import type { Comment } from './comments'
import { applyComments } from './comments'

export function addPixelEquivalentsToValue(value: string, rootFontSize: number): string {
  if (!value.includes('rem')) {
    return value
  }

  parseValue(value).walk((node) => {
    if (node.type !== 'word') {
      return true
    }

    let unit = parseValue.unit(node.value)
    if (!unit || unit.unit !== 'rem') {
      return false
    }

    let commentStr = `/* ${parseFloat(unit.number) * rootFontSize}px */`
    value = value.slice(0, node.sourceEndIndex) + commentStr + value.slice(node.sourceEndIndex)

    return false
  })

  return value
}

function getPixelEquivalentsForMediaQuery(params: string, rootFontSize: number): Comment[] {
  let comments: Comment[] = []

  try {
    parseMediaQueryList(params).forEach((mediaQuery) => {
      mediaQuery.walk(({ node }) => {
        if (
          isTokenNode(node) &&
          node.type === 'token' &&
          node.value[0] === 'dimension-token' &&
          (node.value[4].type === 'integer' || node.value[4].type === 'number') &&
          (node.value[4].unit === 'rem' || node.value[4].unit === 'em')
        ) {
          comments.push({
            index: params.length - (params.length - node.value[3] - 1),
            value: `${node.value[4].value * rootFontSize}px`,
          })
        }
      })
    })
  } catch {}

  return comments
}

export function addPixelEquivalentsToMediaQuery(query: string, rootFontSize: number): string {
  return query.replace(/(?<=^\s*@media\s*).*?$/, (params) => {
    let comments = getPixelEquivalentsForMediaQuery(params, rootFontSize)
    return applyComments(params, comments)
  })
}

export function equivalentPixelValues({
  comments,
  rootFontSize,
}: {
  comments: Comment[]
  rootFontSize: number
}): Plugin {
  return {
    postcssPlugin: 'plugin',
    AtRule: {
      media(atRule) {
        if (!atRule.params.includes('em')) {
          return
        }

        comments.push(
          ...getPixelEquivalentsForMediaQuery(atRule.params, rootFontSize).map(
            ({ index, value }) => ({
              index: index + atRule.source.start.offset + `@media${atRule.raws.afterName}`.length,
              value,
            }),
          ),
        )
      },
    },
    Declaration(decl) {
      if (!decl.value.includes('rem')) {
        return
      }

      parseValue(decl.value).walk((node) => {
        if (node.type !== 'word') {
          return true
        }

        let unit = parseValue.unit(node.value)
        if (!unit || unit.unit !== 'rem') {
          return false
        }

        comments.push({
          index:
            decl.source.start.offset +
            `${decl.prop}${decl.raws.between}`.length +
            node.sourceEndIndex,
          value: `${parseFloat(unit.number) * rootFontSize}px`,
        })

        return false
      })
    },
  }
}
equivalentPixelValues.postcss = true
