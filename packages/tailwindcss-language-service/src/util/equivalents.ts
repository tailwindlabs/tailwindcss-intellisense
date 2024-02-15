import type { TailwindCssSettings } from './state'
import { addPixelEquivalentsToCss } from './pixelEquivalents'
import { addColorEquivalentsToCss } from './colorEquivalents'

export function addEquivalents(css: string, settings: TailwindCssSettings): string {
  if (settings.showPixelEquivalents) {
    css = addPixelEquivalentsToCss(css, settings.rootFontSize)
  }

  css = addColorEquivalentsToCss(css)

  return css
}
