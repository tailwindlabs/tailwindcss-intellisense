import type { State, TailwindCssSettings } from './state'

import type { Plugin } from 'postcss'
import { inlineCalc } from './css-calc'
import { getEquivalentColor } from './colorEquivalents'
import { addPixelEquivalentsToValue } from './pixelEquivalents'
import { Comment } from './comments'

export function wip(state: State, comments: Comment[], settings: TailwindCssSettings): Plugin {
  return {
    postcssPlugin: 'plugin',
    Declaration(decl) {
      let value = inlineCalc(state, decl.value)
      if (value === decl.value) return

      let comment = ''

      let color = getEquivalentColor(value)
      if (color !== value) {
        comment = `${value} = ${color}`
      } else {
        let pixels = addPixelEquivalentsToValue(value, settings.rootFontSize, false)
        if (pixels !== value) {
          comment = `${value} = ${pixels}`
        }
      }

      comments.push({
        index: decl.source.end.offset,
        value: result,
      })
    },
  }
}

export function addThemeValues(state: State, settings: TailwindCssSettings) {
  // Add fallbacks to variables with their theme values
  // Ideally these would just be commentss like
  // `var(--foo) /* 3rem = 48px */` or
  // `calc(var(--spacing) * 5) /* 1.25rem = 20px */`
  css = replaceCssVars(css, (name) => {
    if (!name.startsWith('--')) return null

    let value = state.designSystem.resolveThemeValue?.(name) ?? null
    if (value === null) return null

    let comment = ''

    let color = getEquivalentColor(value)
    if (color !== value) {
      comment = ` /* ${value} = ${color} */`
    } else {
      let pixels = addPixelEquivalentsToValue(value, settings.rootFontSize, false)
      if (pixels !== value) {
        comment = ` /* ${value} = ${pixels} */`
      }
    }

    return `var(${name})${comment}`
  })

  return css
}
