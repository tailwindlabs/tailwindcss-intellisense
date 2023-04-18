import { State } from './state'
import type { Container, Document, Root, Rule, Node, AtRule } from 'postcss'
import { remToPx } from './remToPx'

export function bigSign(bigIntValue) {
  // @ts-ignore
  return (bigIntValue > 0n) - (bigIntValue < 0n)
}

export function generateRules(
  state: State,
  classNames: string[],
  filter: (rule: Rule) => boolean = () => true
): { root: Root; rules: Rule[] } {
  let rules: [bigint, Rule][] = state.modules.jit.generateRules
    .module(new Set(classNames), state.jitContext)
    .sort(([a], [z]) => bigSign(a - z))

  let root = state.modules.postcss.module.root({ nodes: rules.map(([, rule]) => rule) })
  state.modules.jit.expandApplyAtRules.module(state.jitContext)(root)

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

  if (settings.tailwindCSS.showPixelEquivalents) {
    clone.walkDecls((decl) => {
      let px = remToPx(decl.value, settings.tailwindCSS.rootFontSize)
      if (px) {
        decl.value = `${decl.value}/* ${px} */`
      }
    })
  }

  return clone
    .toString()
    .replace(/([^;{}\s])(\n\s*})/g, (_match, before, after) => `${before};${after}`)
    .replace(/^(?:    )+/gm, (indent: string) =>
      ' '.repeat((indent.length / 4) * settings.editor.tabSize)
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
    let px = settings.tailwindCSS.showPixelEquivalents
      ? remToPx(value, settings.tailwindCSS.rootFontSize)
      : undefined
    result.push(`${prop}: ${value}${px ? `/* ${px} */` : ''};`)
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
