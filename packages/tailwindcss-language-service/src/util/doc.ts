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

  return str
}
