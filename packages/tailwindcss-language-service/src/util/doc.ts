import type { Range } from 'vscode-languageserver'
import type { TextDocument } from 'vscode-languageserver-textdocument'
import moo from 'moo'
import { spliceChangesIntoString, StringChange } from './splice-changes-into-string'

export function getTextWithoutComments(
  doc: TextDocument,
  type: 'html' | 'js' | 'jsx' | 'css',
  range?: Range,
): string
export function getTextWithoutComments(text: string, type: 'html' | 'js' | 'jsx' | 'css'): string

export function getTextWithoutComments(
  docOrText: TextDocument | string,
  type: 'html' | 'js' | 'jsx' | 'css',
  range?: Range,
): string {
  let text = typeof docOrText === 'string' ? docOrText : docOrText.getText(range)

  if (type === 'js' || type === 'jsx') {
    return getJsWithoutComments(text)
  }

  if (type === 'css') {
    return getCssWithoutComments(text)
  }

  return text.replace(/<!--.*?-->/gs, replace)
}

function getCssWithoutComments(input: string) {
  const DOUBLE_QUOTE = 0x22 // "
  const SINGLE_QUOTE = 0x27 // '
  const BACKSLASH = 0x5c // \
  const SLASH = 0x2f // /
  const ASTERISK = 0x2a // *
  const LINE_BREAK = 0x0a // \n

  let changes: StringChange[] = []

  // Collect ranges for every comment in the input.
  for (let i = 0; i < input.length; ++i) {
    let currentChar = input.charCodeAt(i)

    if (currentChar === BACKSLASH) {
      i += 1
    }

    // Skip over strings — they are to be left untouched
    else if (currentChar === SINGLE_QUOTE || currentChar === DOUBLE_QUOTE) {
      for (let j = i + 1; j < input.length; ++j) {
        let peekChar = input.charCodeAt(j)

        // Current character is a `\` therefore the next character is escaped.
        if (peekChar === BACKSLASH) {
          j += 1
        }

        // End of the string.
        else if (peekChar === currentChar) {
          i = j
          break
        } else if (peekChar === LINE_BREAK) {
          i = j
          break
        }
      }
    } else if (currentChar === SLASH && input.charCodeAt(i + 1) === ASTERISK) {
      let start = i

      for (let j = i + 2; j < input.length; j++) {
        let peekChar = input.charCodeAt(j)

        // Current character is a `\` therefore the next character is escaped.
        if (peekChar === BACKSLASH) {
          j += 1
        }

        // End of the comment
        else if (peekChar === ASTERISK && input.charCodeAt(j + 1) === SLASH) {
          i = j + 1
          break
        }
      }

      changes.push({
        start,
        end: i + 1,
        replacement: replace(input.slice(start, i + 1)),
      })
    }
  }

  return spliceChangesIntoString(input, changes)
}

function replace(match: string): string {
  return match.replace(/./gs, (char) => (char === '\n' ? '\n' : ' '))
}

let jsLexer: moo.Lexer

function getJsWithoutComments(text: string): string {
  if (!jsLexer) {
    jsLexer = moo.states({
      main: {
        commentLine: /\/\/.*?$/,
        commentBlock: { match: /\/\*[^]*?\*\//, lineBreaks: true },
        stringDouble: /"(?:[^"\\]|\\.)*"/,
        stringSingle: /'(?:[^'\\]|\\.)*'/,
        stringBacktick: /`(?:[^`\\]|\\.)*`/,
        other: { match: /[^]/, lineBreaks: true },
      },
    })
  }

  let str = ''
  jsLexer.reset(text)

  for (let token of jsLexer) {
    if (token.type === 'commentLine') {
      str += ' '.repeat(token.value.length)
    } else if (token.type === 'commentBlock') {
      str += token.value.replace(/./g, ' ')
    } else {
      str += token.value
    }
  }

  str = stripRegexLiterals(str)

  return str
}

function stripRegexLiterals(input: string) {
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

  let SPACE = 0x20 // " "
  let TAB = 0x09 // \t

  // Top level; or
  // after comma
  // after colon
  // after equals
  // after semicolon
  // after square bracket (arrays, object property expressions)
  // after question mark
  // after open paren
  // after curly (jsx only)

  let inRegex = false
  let inEscape = false
  let inCharacterClass = false

  let regexStart = -1
  let regexEnd = -1

  // Based on the oxc_parser crate
  // https://github.com/oxc-project/oxc/blob/5f97f28ddbd2cd303a306f7fb0092b0e54bda43c/crates/oxc_parser/src/lexer/regex.rs#L29
  let prev = null
  for (let i = 0; i < input.length; ++i) {
    let c = input.charCodeAt(i)

    if (inRegex) {
      if (c === LINE_BREAK) {
        break
      } else if (inEscape) {
        inEscape = false
      } else if (c === SLASH && !inCharacterClass) {
        inRegex = false
        regexEnd = i
        break
      } else if (c === BRACKET_OPEN) {
        inCharacterClass = true
      } else if (c === BACKSLASH) {
        inEscape = true
      } else if (c === BRACKET_CLOSE) {
        inCharacterClass = false
      }

      continue
    }

    // Skip over strings
    if (c === SINGLE_QUOTE) {
      for (let j = i; j < input.length; ++j) {
        let peekChar = input.charCodeAt(j)

        if (peekChar === BACKSLASH) {
          j += 1
        } else if (peekChar === SINGLE_QUOTE) {
          i = j
          break
        } else if (peekChar === LINE_BREAK) {
          i = j
          break
        }
      }
    }
    //
    else if (c === DOUBLE_QUOTE) {
      for (let j = i; j < input.length; ++j) {
        let peekChar = input.charCodeAt(j)

        if (peekChar === BACKSLASH) {
          j += 1
        } else if (peekChar === DOUBLE_QUOTE) {
          i = j
          break
        } else if (peekChar === LINE_BREAK) {
          i = j
          break
        }
      }
    }
    //
    else if (c === BACKTICK) {
      for (let j = i; j < input.length; ++j) {
        let peekChar = input.charCodeAt(j)

        if (peekChar === BACKSLASH) {
          j += 1
        } else if (peekChar === BACKTICK) {
          i = j
          break
        } else if (peekChar === LINE_BREAK) {
          i = j
          break
        }
      }
    }
    //
    else if (c === SPACE || c === TAB) {
      // do nothing
    }
    //
    else if (c === SLASH) {
      if (
        prev === COMMA ||
        prev === COLON ||
        prev === EQUALS ||
        prev === SEMICOLON ||
        prev === BRACKET_OPEN ||
        prev === QUESTION_MARK ||
        prev === PAREN_OPEN ||
        prev === CURLY_OPEN ||
        prev === LINE_BREAK
      ) {
        inRegex = true
        regexStart = i
      }
    }
    //
    else {
      prev = c
    }
  }

  // Unterminated regex literal
  if (inRegex) return input

  if (regexStart === -1 || regexEnd === -1) return input

  return (
    input.slice(0, regexStart) + ' '.repeat(regexEnd - regexStart + 1) + input.slice(regexEnd + 1)
  )
}
