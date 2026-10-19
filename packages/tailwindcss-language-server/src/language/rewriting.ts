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
 * Strings, escapes, and unquoted `url(…)` contents are skipped so that
 * something like `content: "/*"` or `url(/icons/*.svg)` doesn't start a
 * comment. An unterminated comment runs until the end of the input.
 */
function findComments(css: string): Range[] {
  let comments: Range[] = []

  for (let i = 0; i < css.length; i++) {
    let char = css.charCodeAt(i)

    // Skip over escapes so that something like `.foo\"bar` doesn't start a string
    if (char === 0x5c /* \ */) {
      i++
      continue
    }

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

    // Skip over the contents of unquoted `url(…)`s
    if (
      (char === 0x75 /* u */ || char === 0x55) /* U */ &&
      css.charCodeAt(i + 3) === 0x28 /* ( */ &&
      css.slice(i, i + 3).toLowerCase() === 'url' &&
      !isIdentChar(css.charCodeAt(i - 1))
    ) {
      let j = i + 4
      while (j < css.length && isWhitespace(css.charCodeAt(j))) j++

      // A quoted url is a regular function containing a string
      let next = css.charCodeAt(j)
      if (next === 0x22 /* " */ || next === 0x27 /* ' */) {
        i = j - 1
        continue
      }

      for (; j < css.length; j++) {
        let next = css.charCodeAt(j)
        if (next === 0x5c /* \ */) {
          j++
        } else if (next === 0x29 /* ) */) {
          break
        }
      }

      i = j
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

function isWhitespace(char: number) {
  return char === 0x20 || char === 0x09 || char === 0x0a || char === 0x0c || char === 0x0d
}

function isIdentChar(char: number) {
  return (
    (char >= 0x61 /* a */ && char <= 0x7a) /* z */ ||
    (char >= 0x41 /* A */ && char <= 0x5a) /* Z */ ||
    (char >= 0x30 /* 0 */ && char <= 0x39) /* 9 */ ||
    char === 0x2d /* - */ ||
    char === 0x5f /* _ */ ||
    char === 0x5c /* \ */ ||
    char >= 0x80
  )
}

/**
 * Like `String.prototype.replace` with a global regex, except matches that
 * start or end inside a comment are left alone.
 *
 * When a match that starts inside a comment is skipped matching resumes at the
 * end of that comment rather than at the end of the skipped match. Otherwise a
 * match that starts in a comment and runs past it could swallow a real at-rule
 * that follows. A match that only ends inside a comment resumes from the next
 * character.
 */
function replaceOutsideComments(
  css: string,
  regex: RegExp,
  replacer: (match: string, ...groups: string[]) => string,
): string {
  let comments = findComments(css)
  if (comments.length === 0) return css.replace(regex, replacer)

  // Comments are sorted and don't overlap so we can binary search them
  let findComment = (offset: number): Range | null => {
    let lo = 0
    let hi = comments.length - 1
    while (lo <= hi) {
      let mid = (lo + hi) >> 1
      let comment = comments[mid]
      if (offset < comment[0]) hi = mid - 1
      else if (offset >= comment[1]) lo = mid + 1
      else return comment
    }
    return null
  }

  let result = ''
  let lastIndex = 0
  regex.lastIndex = 0

  for (let match = regex.exec(css); match; match = regex.exec(css)) {
    let start = match.index
    let end = start + match[0].length

    // The match starts inside a comment so no match can start before the end
    // of that comment
    let comment = findComment(start)
    if (comment) {
      regex.lastIndex = comment[1]
      continue
    }

    // The match ends inside a comment (which means that replacing it would
    // remove the start of that comment)
    if (end > start && findComment(end - 1)) {
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
      // When the `;` is at the start of its line there is no prelude character
      // to put the `{` in so it goes on the first line instead and only the `}`
      // replaces the `;`
      if (lines[lines.length - 1].length === 0) {
        return `@media(${MEDIA_MARKER}){${'\n'.repeat(lines.length - 1)}}`
      }

      // `@media(℘)` is 9 characters long, `{}` replaces the `;` and the last
      // character of the prelude
      return `@media(${MEDIA_MARKER})${'\n'.repeat(lines.length - 1)}${' '.repeat(
        lines[lines.length - 1].length - 1,
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
