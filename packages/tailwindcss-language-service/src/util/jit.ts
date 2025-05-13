import type { State } from './state'
import type { Container, Document, Root, Rule, Node, AtRule } from 'postcss'
import { addPixelEquivalentsToValue } from './pixelEquivalents'
import { addEquivalents } from './equivalents'
import { addThemeValues, inlineThemeValues } from './rewriting'

export function bigSign(bigIntValue: number | bigint): number {
  // @ts-ignore
  return (bigIntValue > 0n) - (bigIntValue < 0n)
}

export function generateRules(
  state: State,
  classNames: string[],
  filter: (rule: Rule) => boolean = () => true,
): { root: Root; rules: Rule[] } {
  let rules: [bigint, Rule][] = state.modules.jit.generateRules
    .module(new Set(classNames), state.jitContext)
    .sort(([a], [z]) => bigSign(a - z))

  let root = state.modules.postcss.module.root({ nodes: rules.map(([, rule]) => rule) })
  state.modules.jit.expandApplyAtRules.module(state.jitContext)(root)
  state.modules.jit.evaluateTailwindFunctions?.module?.(state.jitContext)(root)

  let actualRules: Rule[] = []
  root.walkRules((subRule) => {
    if (filter(subRule)) {
      actualRules.push(subRule)
    }
  })

  return {
    root,
    rules: actualRules,
  }
}

export async function stringifyRoot(state: State, root: Root, uri?: string): Promise<string> {
  let settings = await state.editor.getConfiguration(uri)
  let clone = root.clone()

  clone.walkAtRules('defaults', (node) => {
    node.remove()
  })

  let css = clone.toString()

  css = addThemeValues(css, state, settings.tailwindCSS)
  css = addEquivalents(css, settings.tailwindCSS)

  let identSize = state.v4 ? 2 : 4
  let identPattern = state.v4 ? /^(?:  )+/gm : /^(?:    )+/gm

  return css
    .replace(/([^;{}\s])(\n\s*})/g, (_match, before, after) => `${before};${after}`)
    .replace(identPattern, (indent: string) =>
      ' '.repeat((indent.length / identSize) * settings.editor.tabSize),
    )
}

export function stringifyRules(state: State, rules: Rule[], tabSize: number = 2): string {
  return rules
    .map((rule) => rule.toString().replace(/([^}{;])$/gm, '$1;'))
    .join('\n\n')
    .replace(/^(?:    )+/gm, (indent: string) => ' '.repeat((indent.length / 4) * tabSize))
}

export async function stringifyDecls(state: State, rule: Rule, uri?: string): Promise<string> {
  let settings = await state.editor.getConfiguration(uri)

  let result = []

  rule.walkDecls(({ prop, value }) => {
    // In v4 we inline theme values into declarations (this is a no-op in v3)
    value = inlineThemeValues(value, state).trim()

    if (settings.tailwindCSS.showPixelEquivalents) {
      value = addPixelEquivalentsToValue(value, settings.tailwindCSS.rootFontSize)
    }

    result.push(`${prop}: ${value};`)
  })

  return result.join(' ')
}

function replaceClassName(state: State, selector: string, find: string, replace: string): string {
  const transform = (selectors) => {
    selectors.walkClasses((className) => {
      if (className.value === find) {
        className.value = replace
      }
    })
  }

  return state.modules.postcssSelectorParser.module(transform).processSync(selector)
}

function isAtRule(node: Node): node is AtRule {
  return node.type === 'atrule'
}

export function getRuleContext(state: State, rule: Rule, className: string): string[] {
  let context: string[] = [replaceClassName(state, rule.selector, className, '__placeholder__')]

  let p: Container | Document = rule
  while (p.parent && p.parent.type !== 'root') {
    p = p.parent
    if (isAtRule(p)) {
      context.unshift(`@${p.name} ${p.params}`)
    }
  }

  return context
}
