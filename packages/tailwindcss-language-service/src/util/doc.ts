import type {  Range } from 'vscode-languageserver'
import type { TextDocument } from 'vscode-languageserver-textdocument'
import moo from 'moo'

export function getTextWithoutComments(
  doc: TextDocument,
  type: 'html' | 'js' | 'jsx' | 'css',
  range?: Range
): string
export function getTextWithoutComments(text: string, type: 'html' | 'js' | 'jsx' | 'css'): string
export function getTextWithoutComments(
  docOrText: TextDocument | string,
  type: 'html' | 'js' | 'jsx' | 'css',
  range?: Range
): string {
  let text = typeof docOrText === 'string' ? docOrText : docOrText.getText(range)

  if (type === 'js' || type === 'jsx') {
    return getJsWithoutComments(text)
  }

  if (type === 'css') {
    return text.replace(/\/\*.*?\*\//gs, replace)
  }

  return text.replace(/<!--.*?-->/gs, replace)
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
