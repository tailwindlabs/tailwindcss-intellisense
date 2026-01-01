import type { Range } from 'vscode-languageserver'
import type { TextDocument } from 'vscode-languageserver-textdocument'

const BACKSLASH = 0x5c // \
const SLASH = 0x2f // /
const LINE_BREAK = 0x0a // \n
const COMMA = 0x2c // ,
const COLON = 0x3a // :
const EQUALS = 0x3d // =
const SEMICOLON = 0x3b // ;
const BRACKET_OPEN = 0x5b // [
const BRACKET_CLOSE = 0x5d // ]
const QUESTION_MARK = 0x3f // ?
const PAREN_OPEN = 0x28 // (
const CURLY_OPEN = 0x7b // {
const DOUBLE_QUOTE = 0x22 // "
const SINGLE_QUOTE = 0x27 // '
const BACKTICK = 0x60 // `
const ASTERISK = 0x2a // *
const SPACE = 0x20 // " "
const TAB = 0x09 // \t
const GREATER_THAN = 0x3e // >
const LESS_THAN = 0x3c // <
const EXCLAMATION_MARK = 0x21 // !
const DASH = 0x2d // -

const decoder = new TextDecoder('utf-16')

export function getTextWithoutComments(
  doc: TextDocument,
  type: 'html' | 'js' | 'css',
  range?: Range,
): string

export function getTextWithoutComments(text: string, type: 'html' | 'js' | 'css'): string

/**
 * Cleanup the given document and/or code for analysis
 *
 * We preprocess text to ensure we don't look inside comments for class lists,
 * `@apply` directives, or embedded documents.
 *
 * The following are replaced with whitespace while preserving line breaks:
 * - Single line comments
 * - Multi line comments
 * - Regex literals (where applicable)
 *
 * Preservation of line breaks is critical for mapping positions back to the
 * original source code.
 */
export function getTextWithoutComments(
  input: TextDocument | string,
  type: 'html' | 'js' | 'css',
  range?: Range,
): string {
  let text = typeof input === 'string' ? input : input.getText(range)

  // We want to replace "unncessary" or "uninteresting" substrings with
  // whitespace. Notably, we must do this without changing character offsets
  // or the length of the resulting string. This is critical for mapping
  // offsets and positions back to the original, unprocessed document.
  //
  // We can simplify the replacement process by using a mutable view of the
  // string which eliminates bookkeeping and intermediate allocations.
  //
  // We cannot use the builtin `TextEncoder` as it only outputs UTF-8 bytes and
  // using that would mean that in-place replacements of multi-byte characters
  // with spaces changes the length of the string and any following offsets.
  //
  // Building up a typed array of UTF-16 code units manually is quick, gives us
  // a mutable view of the string, and can be very quickly turned into a string
  // by using `TextDecoder` with a UTF-16 encoding.
  let bytes = new Uint16Array(text.length)

  for (let i = 0; i < text.length; i++) {
    bytes[i] = text.charCodeAt(i)
  }

  if (type === 'js') {
    cleanJS(bytes)
  } else if (type === 'css') {
    cleanCSS(bytes)
  } else if (type === 'html') {
    cleanHTML(bytes)
  }

  return decoder.decode(bytes)
}

/**
 * Clean CSS, SCSS, Less, or similar CSS-like code
 */
function cleanCSS(bytes: Uint16Array): void {
  for (let i = 0; i < bytes.length; ++i) {
    let currentChar = bytes[i]

    if (currentChar === BACKSLASH) {
      i += 1
    }

    // Skip over strings
    else if (currentChar === SINGLE_QUOTE || currentChar === DOUBLE_QUOTE) {
      for (let j = i + 1; j < bytes.length; ++j) {
        let peek = bytes[j]

        // Current character is a `\` therefore the next character is escaped.
        if (peek === BACKSLASH) {
          j += 1
        }

        // End of the string.
        else if (peek === currentChar) {
          i = j
          break
        } else if (peek === LINE_BREAK) {
          i = j
          break
        }
      }
    }

    // Replace comments with whitespace
    else if (currentChar === SLASH && bytes[i + 1] === ASTERISK) {
      let end = bytes.length

      for (let j = i + 2; j < bytes.length; j++) {
        let peek = bytes[j]

        // Current character is a `\` therefore the next character is escaped.
        if (peek === BACKSLASH) {
          j += 1
        }

        // End of the comment
        else if (peek === ASTERISK && bytes[j + 1] === SLASH) {
          end = j + 1
          break
        }
      }

      replaceWithWhitespace(bytes, i, end)

      i = end
    }
  }
}

/**
 * Clean JS, TS, or similar JS-like code
 */
function cleanJS(bytes: Uint16Array): void {
  let inCharacterClass = false
  let prevNonWS = NaN

  // Based on the oxc_parser crate
  // https://github.com/oxc-project/oxc/blob/5f97f28ddbd2cd303a306f7fb0092b0e54bda43c/crates/oxc_parser/src/lexer/regex.rs#L29
  for (let i = 0; i < bytes.length; ++i) {
    let char = bytes[i]
    let peek = bytes[i + 1]

    // Escaped characters
    if (char === BACKSLASH) {
      i += 1
    }

    // Skip over strings using single quotes
    else if (char === SINGLE_QUOTE) {
      for (let j = i + 1; j < bytes.length; ++j) {
        let peek = bytes[j]
        if (peek === BACKSLASH) {
          j += 1
        } else if (peek === SINGLE_QUOTE) {
          i = j
          break
        } else if (peek === LINE_BREAK) {
          i = j
          break
        }
      }
    }

    // Skip over strings using double quotes
    else if (char === DOUBLE_QUOTE) {
      for (let j = i + 1; j < bytes.length; ++j) {
        let peek = bytes[j]
        if (peek === BACKSLASH) {
          j += 1
        } else if (peek === DOUBLE_QUOTE) {
          i = j
          break
        } else if (peek === LINE_BREAK) {
          i = j
          break
        }
      }
    }

    // Skip over template literals
    else if (char === BACKTICK) {
      for (let j = i + 1; j < bytes.length; ++j) {
        let peek = bytes[j]
        if (peek === BACKSLASH) {
          j += 1
        } else if (peek === BACKTICK) {
          i = j
          break
        }
      }
    }

    // Replace single line comments with whitespace
    else if (char === SLASH && peek === SLASH) {
      let end = bytes.length
      for (let j = i + 2; j < bytes.length; ++j) {
        let peek = bytes[j]
        if (peek === LINE_BREAK) {
          end = j
          break
        }
      }

      replaceWithWhitespace(bytes, i, end)

      i = end
    }

    // Replace multi line comments with whitespace but preserve line breaks
    else if (char === SLASH && peek === ASTERISK) {
      let end = bytes.length
      for (let j = i + 2; j < bytes.length; ++j) {
        let curr = bytes[j]
        let peek = bytes[j + 1]
        if (curr === ASTERISK && peek === SLASH) {
          end = j + 1
          break
        }
      }

      replaceWithWhitespace(bytes, i, end)

      i = end
    }

    //
    else if (char === SLASH) {
      let prev = prevNonWS
      let canStartRegex =
        prev === COMMA ||
        prev === COLON ||
        prev === EQUALS ||
        prev === SEMICOLON ||
        prev === BRACKET_OPEN ||
        prev === QUESTION_MARK ||
        prev === PAREN_OPEN ||
        prev === CURLY_OPEN ||
        prev === GREATER_THAN ||
        prev === LINE_BREAK ||
        prev === SPACE ||
        prev === TAB ||
        isNaN(prev)

      if (!canStartRegex) continue

      let end = -1

      for (let j = i + 1; j < bytes.length; ++j) {
        let peek = bytes[j]
        if (peek === LINE_BREAK) {
          end = j
          break
        } else if (peek === BACKSLASH) {
          j += 1
        } else if (peek === SLASH && !inCharacterClass) {
          end = j
          break
        } else if (peek === BRACKET_OPEN) {
          inCharacterClass = true
        } else if (peek === BRACKET_CLOSE) {
          inCharacterClass = false
        }
      }

      // This is likely an unterminated regex literal
      // We'll skip the regex `/` character if this happens and proceed
      // as if it were not there
      if (end === -1) continue

      replaceWithWhitespace(bytes, i, end)
    }

    // Whitespace can be left as is
    else if (char === SPACE || char === TAB) {
      //
    }

    // We want to capture the previous non-whitespace character
    else {
      prevNonWS = char
    }
  }
}

/**
 * Clean HTML or HTML-like code
 *
 * We *intentionally* don't try to skip comments inside "raw text" HTML tags:
 * - <script>:   Legacy behavior, for compat with VERY old browsers.
 * - <style>:    Legacy behavior, for compat with VERY old browsers.
 * - <title>:    Not meant to contain tags. So no class lists.
 * - <textarea>: Not meant to contain tags. So no class lists.
 *
 * @see https://html.spec.whatwg.org/multipage/scripting.html#the-script-element
 * @see https://drafts.csswg.org/css-syntax/#consume-stylesheet-contents
 * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Guides/Comments
 */
function cleanHTML(bytes: Uint16Array): void {
  for (let i = 0; i < bytes.length; ++i) {
    let char = bytes[i]
    let peek = bytes[i + 1]

    // Skip over strings using single quotes
    if (char === SINGLE_QUOTE) {
      for (let j = i + 1; j < bytes.length; ++j) {
        let peek = bytes[j]
        if (peek === BACKSLASH) {
          j += 1
        } else if (peek === SINGLE_QUOTE) {
          i = j
          break
        } else if (peek === LINE_BREAK) {
          i = j
          break
        }
      }
    }

    // Skip over strings using double quotes
    else if (char === DOUBLE_QUOTE) {
      for (let j = i + 1; j < bytes.length; ++j) {
        let peek = bytes[j]
        if (peek === BACKSLASH) {
          j += 1
        } else if (peek === DOUBLE_QUOTE) {
          i = j
          break
        } else if (peek === LINE_BREAK) {
          i = j
          break
        }
      }
    }

    // Possible start of a comment
    else if (char === LESS_THAN && peek === EXCLAMATION_MARK) {
      if (bytes[i + 2] !== DASH) continue
      if (bytes[i + 3] !== DASH) continue

      let end = bytes.length
      for (let j = i + 4; j < bytes.length; ++j) {
        let curr = bytes[j]
        let peek = bytes[j + 1]
        if (curr !== DASH) continue
        if (peek !== DASH) continue
        if (bytes[j + 2] !== GREATER_THAN) continue
        end = j + 2
        break
      }

      replaceWithWhitespace(bytes, i, end)

      i = end
    }
  }
}

function replaceWithWhitespace(bytes: Uint16Array, start: number, end: number) {
  for (let i = start; i <= end; ++i) {
    if (bytes[i] !== LINE_BREAK) bytes[i] = SPACE
  }
}
