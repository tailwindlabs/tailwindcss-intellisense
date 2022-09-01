import type { TextDocument, Range } from 'vscode-languageserver'

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
    return text.replace(/\/\*.*?\*\//gs, replace).replace(/\/\/.*?$/gms, replace)
  }

  if (type === 'css') {
    return text.replace(/\/\*.*?\*\//gs, replace)
  }

  return text.replace(/<!--.*?-->/gs, replace)
}

function replace(match: string): string {
  return match.replace(/./gs, (char) => (char === '\n' ? '\n' : ' '))
}
