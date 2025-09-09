const MEDIA_MARKER = '℘'

function replaceWithAtRule(delta = 0) {
  return (_match: string, p1: string) => {
    let lines = p1.split('\n')
    if (lines.length > 1) {
      return `@media(${MEDIA_MARKER})${'\n'.repeat(lines.length - 1)}${' '.repeat(
        lines[lines.length - 1].length,
      )}{`
    }

    return `@media(${MEDIA_MARKER})${' '.repeat(p1.length + delta)}{`
  }
}

function replaceWithStyleRule(delta = 0) {
  return (_match: string, name: string, p1: string) => {
    let className = '_'.repeat(name.length)
    let spaces = ' '.repeat(p1.length + delta)
    return `.${className}${spaces}{`
  }
}

/**
 * Rewrites the given CSS to be more compatible with the CSS language service
 *
 * The VSCode CSS language service doesn't understand our custom at-rules, nor
 * our custom functions and minor syntax tweaks. This means it will show syntax
 * errors for things that aren't actually errors.
 */
export function rewriteCss(css: string) {
  css = css.replace(/@screen(\s+[^{]+){/g, replaceWithAtRule(-2))
  css = css.replace(/@variants(\s+[^{]+){/g, replaceWithAtRule())
  css = css.replace(/@responsive(\s*){/g, replaceWithAtRule())
  css = css.replace(/@(utility)(\s+[^{]+){/g, replaceWithStyleRule())
  css = css.replace(/@(theme)(\s+[^{]*){/g, replaceWithStyleRule())

  css = css.replace(/@(custom-variant)(\s+[^;{]+);/g, (match: string, name: string) => {
    let spaces = ' '.repeat(match.length - name.length + 3)
    return `@media(${MEDIA_MARKER})${spaces}{}`
  })

  css = css.replace(/@(custom-variant)(\s+[^{]+){/g, replaceWithStyleRule())
  css = css.replace(/@(variant)(\s+[^{]+){/g, replaceWithStyleRule())
  css = css.replace(/@reference\s*([^;]{2,})/g, '@import    $1')

  css = css.replace(
    /@media(\s+screen\s*\([^)]+\))/g,
    (_match, screen) => `@media (${MEDIA_MARKER})${' '.repeat(screen.length - 4)}`,
  )

  css = css.replace(
    /@import(\s*)("(?:[^"]+)"|'(?:[^']+)')\s*(.*?)(?=;|$)/g,
    (_match, spaces, url, other) => {
      // Remove`source(…)`, `theme(…)`, and `prefix(…)` from `@import`s
      // otherwise we'll show syntax-error diagnostics which we don't want
      other = other.replace(/((source|theme|prefix)\([^)]+\)\s*)+?/g, '')

      // We have to add the spaces here so the character positions line up
      return `@import${spaces}"${url.slice(1, -1)}" ${other}`
    },
  )

  css = css.replace(/(?<=\b(?:theme|config)\([^)]*)[.[\]]/g, '_')

  // Ignore `*` in in --value and --modifier functions
  css = css.replace(/--(value|modifier)\((.*?)\)/g, (match) => {
    return match.replace(/[*]/g, '_')
  })

  // Replace `--*` with `--_`
  // Replace `--some-var*` with `--some-var_`
  // Replace `--some-var-*` with `--some-var-_`
  // Replace `--text-*-line-height` with `--text-_-line-height`
  css = css.replace(/--([a-zA-Z0-9-*]*)/g, (match) => {
    return match.replace(/[*]/g, '_')
  })

  return css
}
