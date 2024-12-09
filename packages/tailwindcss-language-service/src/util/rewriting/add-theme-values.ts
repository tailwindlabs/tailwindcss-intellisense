import type { State, TailwindCssSettings } from '../state'

import { evaluateExpression } from './calc'
import { replaceCssVars, replaceCssCalc, Range } from './replacements'
import { addPixelEquivalentsToValue } from '../pixelEquivalents'
import { applyComments, Comment } from '../comments'

export function addThemeValues(css: string, state: State, settings: TailwindCssSettings) {
  let comments: Comment[] = []

  let replaced: Range[] = []

  css = replaceCssCalc(css, (expr) => {
    let inlined = replaceCssVars(expr.value, ({ name }) => {
      if (!name.startsWith('--')) return null

      let value = state.designSystem.resolveThemeValue?.(name) ?? null
      if (value === null) return null

      return value
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

    comments.push({
      index: expr.range.end + 1,
      value: evaluated,
    })

    return null
  })

  css = replaceCssVars(css, ({ name, range }) => {
    if (!name.startsWith('--')) return null

    for (let r of replaced) {
      if (r.start <= range.start && r.end >= range.end) {
        return null
      }
    }

    let value = state.designSystem.resolveThemeValue?.(name) ?? null
    if (value === null) return null

    let px = addPixelEquivalentsToValue(value, settings.rootFontSize, false)
    if (px !== value) {
      comments.push({
        index: range.end + 1,
        value: `${value} = ${px}`,
      })

      return null
    }

    comments.push({
      index: range.end + 1,
      value,
    })

    return null
  })

  comments.sort((a, b) => a.index - b.index)

  return applyComments(css, comments)
}
