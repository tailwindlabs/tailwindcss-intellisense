import * as culori from 'culori'
import {
  ComponentValue,
  isFunctionNode,
  isTokenNode,
  parseComponentValue,
  TokenNode,
} from '@csstools/css-parser-algorithms'
import {
  HashType,
  isTokenHash,
  isTokenIdent,
  stringify,
  tokenize,
  TokenType,
} from '@csstools/css-tokenizer'
import {
  color,
  colorDataFitsDisplayP3_Gamut,
  colorDataFitsRGB_Gamut,
  serializeOKLCH,
  serializeP3,
  serializeRGB,
} from '@csstools/css-color-parser'

const COLOR_FN = /^(rgba?|hsla?|hwb|(ok)?(lab|lch)|color)$/i

export type ParsedColor = culori.Color | null

export function colorFromString(value: string): ParsedColor {
  let tokens = tokenize({ css: value })
  let cv = parseComponentValue(tokens)
  if (!cv) return null

  return colorFromComponentValue(cv)
}

export function colorFromComponentValue(cv: ComponentValue): ParsedColor {
  if (isTokenNode(cv)) {
    if (isTokenIdent(cv.value)) {
      let str = cv.value[4].value.toLowerCase()

      // We can't do anything useful with this so treat it as unparsable
      if (str === 'currentcolor') return null

      if (str === 'transparent') return culori.parse('transparent') ?? null

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

export function equivalentColorFromString(value: string): string | null {
  let color = colorFromString(value)
  let equivalent = computeEquivalentColor(color)
  if (!equivalent) return null

  return equivalent.toString()
}

export function equivalentColorFromComponentValue(cv: ComponentValue): ComponentValue {
  let color = colorFromComponentValue(cv)
  let equivalent = computeEquivalentColor(color)

  return equivalent ?? cv
}

function computeEquivalentColor(color: ParsedColor): TokenNode | null {
  if (!color) return null
  if (typeof color === 'string') return null
  if (!culori.inGamut('rgb')(color)) return null

  let hex: string

  if (color.alpha === undefined || color.alpha === 1) {
    hex = culori.formatHex(color)
  } else {
    hex = culori.formatHex8(color)
  }

  return new TokenNode([TokenType.Hash, hex, 0, 0, { value: hex.slice(1), type: HashType.ID }])
}

export function colorMixFromString(value: string): ParsedColor {
  let tokens = tokenize({ css: value })
  let cv = parseComponentValue(tokens)
  if (!cv) return null

  return colorMixFromComponentValue(cv)
}

export function colorMixFromComponentValue(cv: ComponentValue): ParsedColor {
  let data = color(cv)
  if (!data) return null

  let str: string

  if (colorDataFitsRGB_Gamut(data)) {
    str = serializeRGB(data).toString()
  } else if (colorDataFitsDisplayP3_Gamut(data)) {
    str = serializeP3(data).toString()
  } else {
    str = serializeOKLCH(data).toString()
  }

  return culori.parse(str) ?? null
}
