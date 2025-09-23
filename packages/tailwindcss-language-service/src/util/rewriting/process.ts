import {
  isTokenComma,
  isTokenDimension,
  isTokenIdent,
  isTokenPercentage,
  TokenType,
} from '@csstools/css-tokenizer'
import {
  isFunctionNode,
  ComponentValue,
  isTokenNode,
  isWhitespaceNode,
  FunctionNode,
  CommentNode,
  WhitespaceNode,
  TokenNode,
} from '@csstools/css-parser-algorithms'
import { State } from '../state'
import { walk, VisitFn } from './walk'
import { calcFromComponentValues } from '@csstools/css-calc'
import * as culori from 'culori'
import { createCssSyntax, CssSyntax } from './syntax'
import { colorMixFromComponentValue } from './color'
import { computeSubstitutions } from './vars'

export interface ProcessOptions {
  state: State

  /**
   * How to evaluate the CSS value
   *
   * - **`full-evaluation`**: substitute variables, evaluate calc and color-mix,
   * handle relative color syntax, etc… such that the value is in its simplest
   * possible form.
   *
   * - **`theme-evaluation`**: …
   *
   * - **`user-presentable`**: …
   *
   */
  style: 'user-presentable' | 'theme-evaluation' | 'full-evaluation'
}

interface Context {
  css: CssSyntax

  // WIP
  cyclic: Set<string>

  /**
   * The font size to use for `rem` and `em` values
   */
  fontSize: number | null

  /**
   * A list of CSS variables that can be substituted when referenced
   *
   * These may be referenced via `var(…)`, `theme(…)`, etc…
   */
  variables: Map<string, ComponentValue[]>

  /**
   * A list of seen nodes
   */
  seen: Set<ComponentValue>
}

export interface ProcessorOptions {
  /**
   *
   */
  style: 'full-evaluation' | 'user-presentable'

  /**
   * The font size to use for `rem` and `em` values
   */
  fontSize: number | null

  // WIP
  state?: State

  /**
   * A list of CSS variables that can be substituted when referenced
   *
   * These may be referenced via `var(…)`, `theme(…)`, etc…
   */
  variables: Map<string, string>
}

export function createProcessor(opts: ProcessorOptions): (value: string) => string {
  let css = createCssSyntax()

  let design = opts.state?.designSystem

  if (design) {
    let prefix = design.theme.prefix
    for (let [name] of design.theme.entries()) {
      if (name.startsWith(`--${prefix}-`)) {
        name = '--' + name.slice(3 + prefix.length)
      }

      let value = design.resolveThemeValue?.(name, true)

      opts.variables.set(name, value)

      if (prefix !== '') {
        opts.variables.set(`--${prefix}-${name.slice(2)}`, value)
      }
    }
  }

  let { variables, cyclic } = computeSubstitutions(css, opts.variables)

  let ctx: Context = {
    css,
    cyclic,
    variables,
    fontSize: opts.fontSize,
    seen: new Set(),
  }

  // 1. Replace CSS vars with fallbacks √
  // 2. Down-level color mix √
  // 3. resolving light dark √
  // 4. Evaluate calc √
  // 5. Add equivalents after:
  // - rem √
  // - em √
  // - colors
  // - var(…)
  // - theme(…)

  const FNS: Record<string, (fn: FunctionNode, ctx: Context) => ComponentValue[] | undefined> = {
    // Replace light-dark(x, y) with the light color
    'light-dark': evaluateLightDark,
    calc: evaluateCalc,
    'color-mix': evaluateColorMix,
  }

  return (value: string): string => {
    let css = createCssSyntax()
    let list = css.components(value)

    //
    // Step 1: Variable substitution
    //
    // We perform this *once* to ensure there are no infinite loops. This works because recursive
    // replacements are unnecessary since that was handled ahead of time in computeSubstitutions.
    //
    let toReplace: [ComponentValue[], ComponentValue[], FunctionNode][] = []

    walk(list, {
      exit(node, list) {
        if (!isFunctionNode(node)) return null
        if (node.value.length === 0) return null

        let name = node.getName()
        if (name !== 'var' && name !== 'theme' && name !== '--theme') return null

        let result = substituteVariables(node, ctx)
        if (!result) return null

        toReplace.push([list, result, node])

        return null
      },
    })

    for (let [list, result, fn] of toReplace) {
      let index = list.indexOf(fn)
      if (index === -1) continue
      list.splice(index, 1, ...result)
    }

    //
    // Step 2: Function evaluation
    //
    // This must be done inside-out (on `exit`) because an inner function may evaluate to something
    // an outer function needs for computation.
    //
    walk(list, {
      exit: (node) => {
        if (!isFunctionNode(node)) return null
        if (node.value.length === 0) return null

        let name = node.getName()
        if (name === 'calc') return evaluateCalc(node)
        if (name === 'color-mix') return evaluateColorMix(node, ctx)
        if (name === 'light-dark') return evaluateLightDark(node)

        // We intentionally don't replace theme(…) and --theme(…) here
        // That should be done *once* in the substitution phase
        // This is here to handle nested unknown variables
        if (name === 'var') return substituteVariables(node, ctx, true)

        return null
      },
    })

    //
    // Step 3: Pixel equivalents
    //
    if (opts.style === 'user-presentable') {
      let added = false
      walk(list, {
        exit: (node) => {
          let r = addPixelEquivalents(node, ctx)
          if (!r) return null
          added = true
          return r
        },
      })

      if (!added) return value

      return `${value} ${css.componentsToString(list)}`
    }

    return css.componentsToString(list)
  }
}

function addPixelEquivalents(node: ComponentValue, ctx: Context): ComponentValue[] | null {
  if (!ctx.fontSize) return null
  if (!isTokenNode(node)) return null
  if (!isTokenDimension(node.value)) return null

  let extra = node.value[4]
  if (extra.unit !== 'em' && extra.unit !== 'rem') return null

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

function evaluateLightDark(fn: FunctionNode): ComponentValue[] | undefined {
  let values: ComponentValue[] = []

  for (let value of fn.value) {
    if (isTokenNode(value) && isTokenComma(value.value)) break

    values.push(value)
  }

  return values
}

function evaluateCalc(fn: FunctionNode): ComponentValue[] | null {
  let solved = calcFromComponentValues([[fn]], {
    // Ensure evaluation of random() is deterministic
    randomCaching: {
      propertyName: 'width',
      propertyN: 1,
      elementID: '1',
      documentID: '1',
    },

    // Limit precision to keep values environment independent
    precision: 6,
  })

  return solved[0] ?? null
}

function evaluateColorMix(fn: FunctionNode, ctx: Context): ComponentValue[] | null {
  let color = colorMixFromComponentValue(fn)
  if (!color) return null

  return ctx.css.components(culori.formatRgb(color))
}

function substituteVariables(
  fn: FunctionNode,
  ctx: Context,
  unknownOnly: boolean = false,
): ComponentValue[] | null {
  for (let i = 0; i < fn.value.length; ++i) {
    let value = fn.value[i]

    if (!isTokenNode(value)) continue

    if (isTokenIdent(value.value)) {
      let name = value.value[1]

      // Lookup in the theme
      let resolvedValue = ctx.variables.get(name)
      if (unknownOnly && resolvedValue) continue
      if (resolvedValue) return resolvedValue
    }

    // The var(…) or theme(…) fn couldn't be resolved to a value
    // so we replace it with the fallback value which is everything
    // after the first comma
    else if (isTokenComma(value.value)) {
      return fn.value.slice(i + 1)
    }
  }

  return null
}
