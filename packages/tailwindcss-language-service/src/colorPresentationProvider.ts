import type { State } from './util/state'
import type { Range, TextDocument } from 'vscode-languageserver-textdocument'
import type { Color, ColorPresentation, ColorPresentationParams } from 'vscode-languageserver'
import * as culori from 'culori'
import namedColors from 'color-name'

const colorNames = Object.keys(namedColors)

export async function provideColorPresentation(
  state: State,
  document: TextDocument,
  lscolor: Color,
  range: Range,
): Promise<ColorPresentation[]> {
  let className = document.getText(range)
  let match = className.match(
    new RegExp(`-\\[(${colorNames.join('|')}|(?:(?:#|rgba?\\(|hsla?\\())[^\\]]+)\\]$`, 'i'),
  )
  // let match = className.match(/-\[((?:#|rgba?\(|hsla?\()[^\]]+)\]$/i)
  if (match === null) return []

  let currentColor = match[1]

  let isNamedColor = colorNames.includes(currentColor)

  let color: culori.Color = {
    mode: 'rgb',
    r: lscolor.red,
    g: lscolor.green,
    b: lscolor.blue,
    alpha: lscolor.alpha,
  }

  let hexValue = culori.formatHex8(color)

  if (!isNamedColor && (currentColor.length === 4 || currentColor.length === 5)) {
    let [, ...chars] = hexValue.match(/^#([a-f\d])\1([a-f\d])\2([a-f\d])\3(?:([a-f\d])\4)?$/i) ?? []
    if (chars.length) {
      hexValue = `#${chars.filter(Boolean).join('')}`
    }
  }

  if (hexValue.length === 5) {
    hexValue = hexValue.replace(/f$/, '')
  } else if (hexValue.length === 9) {
    hexValue = hexValue.replace(/ff$/, '')
  }

  let prefix = className.substr(0, match.index)

  return [
    hexValue,
    culori.formatRgb(color).replace(/ /g, ''),
    culori
      .formatHsl(color)
      .replace(/ /g, '')
      // round numbers
      .replace(/\d+\.\d+(%?)/g, (value, suffix) => `${Math.round(parseFloat(value))}${suffix}`),
  ].map((value) => ({ label: `${prefix}-[${value}]` }))
}
