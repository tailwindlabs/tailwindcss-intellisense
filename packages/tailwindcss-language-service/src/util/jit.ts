import { State } from './state'
import type { Container, Root, Rule } from 'postcss'
import dlv from 'dlv'
import { remToPx } from './remToPx'

export function bigSign(bigIntValue) {
  // @ts-ignore
  return (bigIntValue > 0n) - (bigIntValue < 0n)
}

export function generateRules(state: State, classNames: string[]): { root: Root; rules: Rule[] } {
  let rules: [bigint, Rule][] = state.modules.jit.generateRules
    .module(new Set(classNames), state.jitContext)
    .sort(([a], [z]) => bigSign(a - z))

  let actualRules: Rule[] = []

  for (let [, rule] of rules) {
    if (rule.type === 'rule') {
      actualRules.push(rule)
    } else if (rule.walkRules) {
      rule.walkRules((subRule) => {
        actualRules.push(subRule)
      })
    }
  }

  return {
    root: state.modules.postcss.module.root({ nodes: rules.map(([, rule]) => rule) }),
    rules: actualRules,
  }
}

export async function stringifyRoot(state: State, root: Root, uri?: string): Promise<string> {
  let settings = await state.editor.getConfiguration(uri)
  let tabSize = dlv(settings, 'editor.tabSize', 2)
  let showPixelEquivalents = dlv(settings, 'tailwindCSS.showPixelEquivalents', true)
  let rootFontSize = dlv(settings, 'tailwindCSS.rootFontSize', 16)

  let clone = root

  if (showPixelEquivalents) {
    clone = root.clone()
    clone.walkDecls((decl) => {
      let px = remToPx(decl.value, rootFontSize)
      if (px) {
        decl.value = `${decl.value}/* ${px} */`
      }
    })
  }

  return clone
    .toString()
    .replace(/([^}{;])$/gm, '$1;')
    .replace(/^(?:    )+/gm, (indent: string) => ' '.repeat((indent.length / 4) * tabSize))
}

export function stringifyRules(state: State, rules: Rule[], tabSize: number = 2): string {
  return rules
    .map((rule) => rule.toString().replace(/([^}{;])$/gm, '$1;'))
    .join('\n\n')
    .replace(/^(?:    )+/gm, (indent: string) => ' '.repeat((indent.length / 4) * tabSize))
}

export function stringifyDecls(rule: Rule): string {
  let result = []
  rule.walkDecls(({ prop, value }) => {
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

export function getRuleContext(state: State, rule: Rule, className: string): string[] {
  let context: string[] = [replaceClassName(state, rule.selector, className, '__placeholder__')]

  let p: Container = rule
  while (p.parent.type !== 'root') {
    p = p.parent
    if (p.type === 'atrule') {
      // @ts-ignore
      context.unshift(`@${p.name} ${p.params}`)
    }
  }

  return context
}
