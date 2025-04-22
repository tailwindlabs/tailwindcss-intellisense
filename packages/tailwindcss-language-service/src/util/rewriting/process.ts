// Process CSS values
import {
  CSSToken,
  isTokenComma,
  isTokenDimension,
  isTokenIdent,
  isTokenPercentage,
  stringify,
  tokenize,
  TokenPercentage,
  TokenType,
} from '@csstools/css-tokenizer'
import {
  isFunctionNode,
  parseComponentValue,
  parseCommaSeparatedListOfComponentValues,
  ComponentValue,
  isTokenNode,
  TokenNode,
  parseListOfComponentValues,
  isWhitespaceNode,
  FunctionNode,
  CommentNode,
  WhitespaceNode,
} from '@csstools/css-parser-algorithms'
import { State } from '../state'
import walk, { VisitFn, Visitor } from './walk'
import { resolveVariableValue } from './lookup'
import { DefaultMap } from '../default-map'
import { calcFromComponentValues } from '@csstools/css-calc'
import * as culori from 'culori'

export interface ProcessOptions {
  state: State

  /**
   * The font size to use for `rem` and `em` values
   */
  fontSize: number | null

  style: 'user-presetable' | 'theme-evaluation' | 'full-evaluation'
}

interface Context {
  state: State
  tokens: DefaultMap<string, CSSToken[]>
  values: DefaultMap<string, ComponentValue[]>

  /**
   * The font size to use for `rem` and `em` values
   */
  fontSize: number | null

  /**
   * A list of expanded theme variables
   */
  seen: Set<string>
}

export function process(value: string, opts: ProcessOptions): string {
  let tokens = new DefaultMap((css) => tokenize({ css }))

  let values = new DefaultMap((css) => parseListOfComponentValues(tokens.get(css)))
  let ctx: Context = {
    seen: new Set(),
    state: opts.state,
    tokens,
    values,
    fontSize: opts.fontSize,
  }

  let lists = parseCommaSeparatedListOfComponentValues(tokens.get(value))

  // 1. Replace CSS vars with fallbacks √
  // 2. Down-level color mix √
  // 3. resolving light dark √
  // 4. Evaluate calc √
  // 5. Add equivalents after:
  // - rem
  // - em
  // - colors
  // - var(…)
  // - theme(…)

  let visitors = [
    //
    evaluateFunctions(ctx),
    addPixelEquivalents(ctx),
  ]

  for (let list of lists) {
    walk(list, {
      exit(node) {
        for (let visit of visitors) {
          let result = visit(node)
          if (result) return result
        }
      },
    })
  }

  return lists.map((list) => list.map((value) => stringify(...value.tokens())).join('')).join(',')
}

function evaluateFunctions(ctx: Context): VisitFn {
  return (node) => {
    if (!isFunctionNode(node)) return
    if (node.value.length === 0) return

    let compute = FNS[node.getName()]
    if (!compute) return

    return compute(node, ctx)
  }
}

function addPixelEquivalents(ctx: Context): VisitFn {
  return (node) => {
    if (!ctx.fontSize) return
    if (!isTokenNode(node)) return
    if (!isTokenDimension(node.value)) return

    let extra = node.value[4]
    if (extra.unit !== 'em' && extra.unit !== 'rem') return

    let valueInPx = extra.value * ctx.fontSize

    return [
      node,
      new WhitespaceNode([[TokenType.Whitespace, ` `, 0, 0, undefined]]),
      new CommentNode([
        TokenType.Comment,
        `/* ${node.value[1]} = ${valueInPx}px */`,
        0,
        0,
        undefined,
      ]),
    ]
  }
}

const FNS: Record<string, (fn: FunctionNode, ctx: Context) => ComponentValue[] | undefined> = {
  // Replace light-dark(x, y) with the light color
  'light-dark': evaluateLightDark,
  calc: evaluateCalc,
  var: resolveThemeVariable,
  theme: resolveThemeVariable,
  'color-mix': evaluateColorMix,
}

function evaluateLightDark(fn: FunctionNode): ComponentValue[] | undefined {
  let values: ComponentValue[] = []

  for (let value of fn.value) {
    if (isTokenNode(value) && isTokenComma(value.value)) break
    values.push(value)
  }

  return values
}

function evaluateCalc(fn: FunctionNode): ComponentValue[] | undefined {
  let solved = calcFromComponentValues([[fn]], {
    // Ensure evaluation of random() is deterministic
    randomSeed: 1,

    // Limit precision to keep values environment independent
    precision: 4,
  })

  return solved[0]
}

function evaluateColorMix(fn: FunctionNode, ctx: Context): ComponentValue[] | undefined {
  let state: 'colorspace' | 'a' | 'b' | 'done' = 'colorspace'

  let colorValues: ComponentValue[] = []
  let alphaValue: number | null = null

  for (let i = 0; i < fn.value.length; ++i) {
    let value = fn.value[i]

    if (state === 'colorspace') {
      if (isTokenNode(value) && value.value[0] === 'comma-token') {
        state = 'a'
      }
    }

    //
    else if (state === 'a') {
      if (isWhitespaceNode(value)) continue

      if (isTokenNode(value) && isTokenPercentage(value.value)) {
        alphaValue = value.value[4].value
        state = 'b'
      } else {
        colorValues.push(value)
      }
    }

    //
    else if (state === 'b') {
      if (isWhitespaceNode(value)) continue
      if (!isTokenNode(value)) continue
      if (!isTokenIdent(value.value)) continue
      if (value.value[1] !== 'transparent') continue

      state = 'done'
    }

    //
    else if (state === 'done') {
      if (isWhitespaceNode(value)) continue

      return
    }
  }

  if (alphaValue === null) return
  if (colorValues.length === 0) return

  let colorStr = stringify(...colorValues.flatMap((v) => v.tokens()))
  if (colorStr.startsWith('var(')) return

  let parsed = culori.parse(colorStr)
  if (!parsed) return

  let alpha = Number(alphaValue) / 100
  if (Number.isNaN(alpha)) return

  alpha *= parsed.alpha ?? 1

  let color = culori.formatRgb({ ...parsed, alpha })

  return ctx.values.get(color)
}

function resolveThemeVariable(fn: FunctionNode, ctx: Context): ComponentValue[] | undefined {
  for (let i = 0; i < fn.value.length; ++i) {
    let value = fn.value[i]

    if (!isTokenNode(value)) continue

    if (isTokenIdent(value.value)) {
      let name = value.value[1]

      // Lookup in the theme
      let themeValue = resolveVariableValue(ctx.state.designSystem, name)
      if (themeValue) return ctx.values.get(themeValue)

      // If it's one of these predefined alpha variables it's always 100%
      if (
        name === '--tw-text-shadow-alpha' ||
        name === '--tw-drop-shadow-alpha' ||
        name === '--tw-shadow-alpha'
      ) {
        return ctx.values.get('100%')
      }
    }

    // The var(…) or theme(…) fn couldn't be resolved to a value
    // so we replace it with the fallback value which is everything
    // after the first comma
    else if (isTokenComma(value.value)) {
      return fn.value.slice(i + 1)
    }
  }
}
