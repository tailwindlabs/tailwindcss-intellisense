import * as culori from 'culori'
import {
  ComponentValue,
  isFunctionNode,
  isTokenNode,
  isWhitespaceNode,
  parseComponentValue,
} from '@csstools/css-parser-algorithms'
import {
  isTokenComma,
  isTokenHash,
  isTokenIdent,
  isTokenNumber,
  isTokenNumeric,
  isTokenPercentage,
  stringify,
  tokenize,
} from '@csstools/css-tokenizer'

const COLOR_FN = /^(rgba?|hsla?|hwb|(ok)?(lab|lch)|color)$/i

export type KeywordColor = 'currentColor'
export type ParsedColor = culori.Color | KeywordColor | null

export function colorFromString(value: string): ParsedColor {
  let tokens = tokenize({ css: value })
  let cv = parseComponentValue(tokens)
  let color = colorFromComponentValue(cv)

  return color
}

export function colorFromComponentValue(cv: ComponentValue): ParsedColor {
  if (isTokenNode(cv)) {
    if (isTokenIdent(cv.value)) {
      let str = cv.value[4].value.toLowerCase()

      if (str === 'currentcolor') return 'currentColor'

      if (str === 'transparent') {
        // We omit rgb channels instead of using transparent black because we
        // use `culori.interpolate` to mix colors and it handles `transparent`
        // differently from the spec (all channels are mixed, not just alpha)
        return culori.parse('rgb(none none none / 0.5)')
      }

      if (str in culori.colorsNamed) {
        return culori.parseNamed(str as keyof typeof culori.colorsNamed) ?? null
      }
    }

    //
    else if (isTokenHash(cv.value)) {
      let hex = cv.value[4].value.toLowerCase()

      return culori.parseHex(hex) ?? null
    }

    return null
  }

  //
  else if (isFunctionNode(cv)) {
    let fn = cv.getName()

    if (COLOR_FN.test(fn)) {
      return culori.parse(stringify(...cv.tokens())) ?? null
    }
  }

  return null
}

export function equivalentColorFromString(value: string): string {
  let color = colorFromString(value)
  let equivalent = computeEquivalentColor(color)

  return equivalent ?? value
}

function computeEquivalentColor(color: ParsedColor): string | null {
  if (!color) return null
  if (typeof color === 'string') return null
  if (!culori.inGamut('rgb')(color)) return null

  if (color.alpha === undefined || color.alpha === 1) {
    return culori.formatHex(color)
  }

  return culori.formatHex8(color)
}

export function colorMixFromString(value: string): ParsedColor {
  let tokens = tokenize({ css: value })
  let cv = parseComponentValue(tokens)
  let color = colorMixFromComponentValue(cv)

  return color
}

export function colorMixFromComponentValue(cv: ComponentValue): ParsedColor {
  if (!isFunctionNode(cv)) return null
  if (cv.getName() !== 'color-mix') return null

  let state: 'in' | 'colorspace' | 'colors' = 'in'
  let colorspace: string = ''
  let colors: Array<culori.Color | number> = []

  for (let i = 0; i < cv.value.length; ++i) {
    let value = cv.value[i]

    if (isWhitespaceNode(value)) continue

    if (state === 'in') {
      if (isTokenNode(value)) {
        if (isTokenIdent(value.value)) {
          if (value.value[4].value === 'in') {
            state = 'colorspace'
          }
        }
      }
    } else if (state === 'colorspace') {
      if (isTokenNode(value)) {
        if (isTokenIdent(value.value)) {
          if (colorspace !== '') return null

          colorspace = value.value[4].value
        } else if (isTokenComma(value.value)) {
          state = 'colors'
        }
      }
    } else if (state === 'colors') {
      if (isTokenNode(value)) {
        if (isTokenPercentage(value.value)) {
          colors.push(value.value[4].value / 100)
          continue
        } else if (isTokenNumber(value.value)) {
          colors.push(value.value[4].value)
          continue
        } else if (isTokenComma(value.value)) {
          continue
        }
      }

      let color = colorFromComponentValue(value)
      if (!color) return null
      if (typeof color === 'string') return null
      colors.push(color)
    }
  }

  let t = culori.interpolate(colors, colorspace as any)

  return t(0.5) ?? null
}
