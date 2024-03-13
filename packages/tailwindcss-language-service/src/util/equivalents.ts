import type { TailwindCssSettings } from './state'
import { equivalentPixelValues } from './pixelEquivalents'
import { equivalentColorValues } from './colorEquivalents'
import postcss, { type AcceptedPlugin } from 'postcss'
import { applyComments, type Comment } from './comments'

export function addEquivalents(css: string, settings: TailwindCssSettings): string {
  let comments: Comment[] = []

  let plugins: AcceptedPlugin[] = []

  if (settings.showPixelEquivalents) {
    plugins.push(
      equivalentPixelValues({
        comments,
        rootFontSize: settings.rootFontSize,
      }),
    )
  }

  plugins.push(equivalentColorValues({ comments }))

  try {
    postcss(plugins).process(css, { from: undefined }).css
  } catch {
    return css
  }

  return applyComments(css, comments)
}
