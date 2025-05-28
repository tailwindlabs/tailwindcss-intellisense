import { readFile } from 'node:fs/promises'
import path from 'node:path'
import vsctm from 'vscode-textmate'
import oniguruma from 'vscode-oniguruma'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { KNOWN_SCOPES } from './scopes'
import { DefaultMap } from './default-map'

const require = createRequire(import.meta.url)

export interface TokenizeResult {
  toString(): string
}

export interface TokenizedScope {
  /**
   * The name of the scope
   */
  name: string

  /**
   * An ordered list of ranges as they appear, one per token
   */
  ranges: [start: number, end: number][]
}

export interface Grammar {
  tokenize(text: string, scope?: string): Promise<TokenizeResult>
}

// 1. Each line has a list of scopes
// 2. Each scope has a set of ranges, one per token
// 3. If two consecutive scopes have identical range lists they can be merged

// @utility custom {
// ^^^^^^^^^^^^^^^^^                     11 tok: source.css.tailwind
// ^^^^^^^^                               2 tok: keyword.control.at-rule.utility.tailwind
// ^                                      1 tok: punctuation.definition.keyword.css
//          ^^^^^^                        6 tok: variable.parameter.utility.tailwind
//                 ^                      1 tok: meta.at-rule.utility.body.tailwind punctuation.section.utility.begin.bracket.curly.tailwind

function tokenizeText(grammar: vsctm.IGrammar, text: string): TokenizeResult {
  let str = ''

  let results: [string, vsctm.ITokenizeLineResult][] = []

  let ruleStack = vsctm.INITIAL
  let maxEndIndex = 0
  for (let line of text.split(/\r\n|\r|\n/g)) {
    let result = grammar.tokenizeLine(line, ruleStack)
    ruleStack = result.ruleStack
    maxEndIndex = Math.max(maxEndIndex, ...result.tokens.map((t) => t.endIndex))
    results.push([line, result])
  }

  for (let [line, result] of results) {
    // 1. Collect the scope information for this line
    let scopes = new DefaultMap<string, TokenizedScope>((name) => ({ name, ranges: [] }))

    for (let token of result.tokens) {
      let range = [token.startIndex, token.endIndex] as [number, number]
      for (let name of token.scopes) {
        scopes.get(name).ranges.push(range)
      }
    }

    let maxTokenCount = Math.max(...Array.from(scopes.values(), (s) => s.ranges.length))
    let tokenCountSpace = Math.max(2, maxTokenCount.toString().length)

    // 2. Write information to the output
    str += '\n'
    str += line

    let lastRangeKey = ''

    for (let scope of scopes.values()) {
      let currentRangeKey = scope.ranges.map((r) => `${r[0]}:${r[1]}`).join(',')
      if (lastRangeKey === currentRangeKey) {
        str += ' '
        str += scope.name
        continue
      }
      lastRangeKey = currentRangeKey

      str += '\n'

      let lastRangeEnd = 0
      for (let range of scope.ranges) {
        str += ' '.repeat(range[0] - lastRangeEnd)
        str += '^'.repeat(range[1] - range[0])
        lastRangeEnd = range[1]
      }
      str += ' '.repeat(maxEndIndex - lastRangeEnd)

      str += ' '
      str += scope.ranges.length.toString().padStart(tokenCountSpace)
      str += ': '
      str += scope.name
    }

    str += '\n'
  }

  return {
    toString: () => str,
  }
}

export async function loadGrammar() {
  let wasm = await readFile(require.resolve('vscode-oniguruma/release/onig.wasm'))
  await oniguruma.loadWASM(wasm)

  let registry = new vsctm.Registry({
    onigLib: Promise.resolve({
      createOnigScanner: (patterns) => new oniguruma.OnigScanner(patterns),
      createOnigString: (s) => new oniguruma.OnigString(s),
    }),

    async loadGrammar(scope) {
      let meta = KNOWN_SCOPES[scope]
      if (!meta) throw new Error(`Unknown scope name: ${scope}`)

      let grammar = await meta.content.then((m) => m.default)

      return vsctm.parseRawGrammar(JSON.stringify(grammar), `${scope}.json`)
    },

    getInjections(scope) {
      let parts = scope.split('.')

      let injections: string[] = []
      for (let i = 1; i <= parts.length; i++) {
        let subscope = parts.slice(0, i).join('.')
        injections.push(...(KNOWN_SCOPES[subscope]?.inject ?? []))
      }

      return injections
    },
  })

  async function tokenize(text: string, scope?: string): Promise<TokenizeResult> {
    let grammar = await registry.loadGrammar(scope ?? 'source.css.tailwind')
    return tokenizeText(grammar, text)
  }

  return {
    tokenize,
  }
}
