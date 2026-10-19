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
    let lines = p1.split('\n')
    if (lines.length > 1) {
      return `.${className}${'\n'.repeat(lines.length - 1)}${' '.repeat(
        lines[lines.length - 1].length,
      )}{`
    }

    let spaces = ' '.repeat(p1.length + delta)
    return `.${className}${spaces}{`
  }
}

type Range = [start: number, end: number]

/**
 * Find the ranges of all `/* … *\/` comments in the given CSS
 *
 * Strings are skipped so that something like `content: "/*"` doesn't start a
 * comment. An unterminated comment runs until the end of the input.
 */
function findComments(css: string): Range[] {
  let comments: Range[] = []

  for (let i = 0; i < css.length; i++) {
    let char = css.charCodeAt(i)

    // Skip over strings
    if (char === 0x22 /* " */ || char === 0x27 /* ' */) {
      for (i++; i < css.length; i++) {
        let next = css.charCodeAt(i)
        if (next === 0x5c /* \ */) {
          i++
        } else if (next === char || next === 0x0a /* \n */) {
          break
        }
      }
      continue
    }

    if (char === 0x2f /* / */ && css.charCodeAt(i + 1) === 0x2a /* * */) {
      let end = css.indexOf('*/', i + 2)
      end = end === -1 ? css.length : end + 2
      comments.push([i, end])
      i = end - 1
    }
  }

  return comments
}

/**
 * Like `String.prototype.replace` with a global regex, except matches that
 * start or end inside a comment are left alone.
 *
 * When a match is skipped matching resumes from the next character rather
 * than from the end of the skipped match. Otherwise a match that starts in a
 * comment and runs past it could swallow a real at-rule that follows.
 */
function replaceOutsideComments(
  css: string,
  regex: RegExp,
  replacer: (match: string, ...groups: string[]) => string,
): string {
  let comments = findComments(css)
  if (comments.length === 0) return css.replace(regex, replacer)

  // Comments are sorted and don't overlap so we can binary search them
  let isInComment = (offset: number) => {
    let lo = 0
    let hi = comments.length - 1
    while (lo <= hi) {
      let mid = (lo + hi) >> 1
      let [start, end] = comments[mid]
      if (offset < start) hi = mid - 1
      else if (offset >= end) lo = mid + 1
      else return true
    }
    return false
  }

  let result = ''
  let lastIndex = 0
  regex.lastIndex = 0

  for (let match = regex.exec(css); match; match = regex.exec(css)) {
    let start = match.index
    let end = start + match[0].length

    // The match starts inside a comment or ends inside one (which means that
    // replacing it would remove the start of that comment)
    if (isInComment(start) || (end > start && isInComment(end - 1))) {
      regex.lastIndex = start + 1
      continue
    }

    result += css.slice(lastIndex, start)
    result += replacer(...(match as unknown as [string, ...string[]]))
    lastIndex = end

    if (match[0].length === 0) regex.lastIndex++
  }

  return result + css.slice(lastIndex)
}

/**
 * Rewrites the given CSS to be more compatible with the CSS language service
 *
 * The VSCode CSS language service doesn't understand our custom at-rules, nor
 * our custom functions and minor syntax tweaks. This means it will show syntax
 * errors for things that aren't actually errors.
 */
export function rewriteCss(css: string) {
  css = replaceOutsideComments(css, /@screen(\s+[^{]+){/g, replaceWithAtRule(-2))
  css = replaceOutsideComments(css, /@variants(\s+[^{]+){/g, replaceWithAtRule())
  css = replaceOutsideComments(css, /@responsive(\s*){/g, replaceWithAtRule())
  css = replaceOutsideComments(css, /@(utility)(\s+[^{]+){/g, replaceWithStyleRule())
  css = replaceOutsideComments(css, /@(theme)(\s+[^{]*){/g, replaceWithStyleRule())

  css = replaceOutsideComments(css, /@(custom-variant)(\s+[^;{]+);/g, (match, name, p1) => {
    let lines = p1.split('\n')
    if (lines.length > 1) {
      // `@media(℘)` is 9 characters long, `{}` replaces the `;` and the last
      // character of the prelude
      return `@media(${MEDIA_MARKER})${'\n'.repeat(lines.length - 1)}${' '.repeat(
        Math.max(0, lines[lines.length - 1].length - 1),
      )}{}`
    }

    let spaces = ' '.repeat(match.length - name.length + 3)
    return `@media(${MEDIA_MARKER})${spaces}{}`
  })

  css = replaceOutsideComments(css, /@(custom-variant)(\s+[^{]+){/g, replaceWithStyleRule())
  css = replaceOutsideComments(css, /@(variant)(\s+[^{]+){/g, replaceWithStyleRule())
  css = replaceOutsideComments(
    css,
    /@reference\s*([^;]{2,})/g,
    (_match, rest) => `@import    ${rest}`,
  )

  css = replaceOutsideComments(
    css,
    /@media(\s+screen\s*\([^)]+\))/g,
    (_match, screen) => `@media (${MEDIA_MARKER})${' '.repeat(screen.length - 4)}`,
  )

  css = replaceOutsideComments(
    css,
    /@import(\s*)("(?:[^"]+)"|'(?:[^']+)')\s*(.*?)(?=;|$)/g,
    (_match, spaces, url, other) => {
      // Remove`source(…)`, `theme(…)`, and `prefix(…)` from `@import`s
      // otherwise we'll show syntax-error diagnostics which we don't want
      other = other.replace(/((source|theme|prefix)\([^)]+\)\s*)+?/g, '')

      // We have to add the spaces here so the character positions line up
      return `@import${spaces}"${url.slice(1, -1)}" ${other}`
    },
  )

  css = replaceOutsideComments(css, /(?<=\b(?:theme|config)\([^)]*)[.[\]]/g, () => '_')

  // Ignore `*` in in --value and --modifier functions
  css = replaceOutsideComments(css, /--(value|modifier)\((.*?)\)/g, (match) => {
    return match.replace(/[*]/g, '_')
  })

  // Replace `--*` with `--_`
  // Replace `--some-var*` with `--some-var_`
  // Replace `--some-var-*` with `--some-var-_`
  // Replace `--text-*-line-height` with `--text-_-line-height`
  css = replaceOutsideComments(css, /--([a-zA-Z0-9-*]*)/g, (match) => {
    return match.replace(/[*]/g, '_')
  })

  return css
}
