import type { State, TailwindCssSettings } from '../state'

import { evaluateExpression } from './calc'
import { replaceCssVars, replaceCssCalc, Range } from './replacements'
import { addPixelEquivalentsToValue } from '../pixelEquivalents'
import { applyComments, Comment } from '../comments'
import { getEquivalentColor } from '../colorEquivalents'
import { resolveVariableValue } from './lookup'

export function addThemeValues(css: string, state: State, settings: TailwindCssSettings): string {
  if (!state.designSystem) return css

  let comments: Comment[] = []
  let replaced: Range[] = []

  css = replaceCssCalc(css, (expr) => {
    let inlined = replaceCssVars(expr.value, {
      replace({ name }) {
        if (!name.startsWith('--')) return null

        let value = resolveVariableValue(state.designSystem, name)
        if (value === null) return null

        // Inline CSS calc expressions in theme values
        value = replaceCssCalc(value, (expr) => evaluateExpression(expr.value))

        return value
      },
    })

    let evaluated = evaluateExpression(inlined)

    // No changes were made so we can just return the original expression
    if (expr.value === evaluated) return null
    if (!evaluated) return null

    replaced.push(expr.range)

    let px = addPixelEquivalentsToValue(evaluated, settings.rootFontSize, false)
    if (px !== evaluated) {
      comments.push({
        index: expr.range.end + 1,
        value: `${evaluated} = ${px}`,
      })

      return null
    }

    let color = getEquivalentColor(evaluated)
    if (color !== evaluated) {
      comments.push({
        index: expr.range.end + 1,
        value: `${evaluated} = ${color}`,
      })

      return null
    }

    comments.push({
      index: expr.range.end + 1,
      value: evaluated,
    })

    return null
  })

  css = replaceCssVars(css, {
    recursive: false,
    replace({ name, range }) {
      if (!name.startsWith('--')) return null

      for (let r of replaced) {
        if (r.start <= range.start && r.end >= range.end) {
          return null
        }
      }

      let value = resolveVariableValue(state.designSystem, name)
      if (value === null) return null

      let px = addPixelEquivalentsToValue(value, settings.rootFontSize, false)
      if (px !== value) {
        comments.push({
          index: range.end + 1,
          value: `${value} = ${px}`,
        })

        return null
      }

      let color = getEquivalentColor(value)
      if (color !== value) {
        comments.push({
          index: range.end + 1,
          value: `${value} = ${color}`,
        })

        return null
      }

      // Inline CSS calc expressions in theme values
      value = replaceCssCalc(value, (expr) => {
        let evaluated = evaluateExpression(expr.value)
        if (!evaluated) return null
        if (evaluated === expr.value) return null

        return `calc(${expr.value}) ≈ ${evaluated}`
      })

      comments.push({
        index: range.end + 1,
        value,
      })

      return null
    },
  })

  return applyComments(css, comments)
}
