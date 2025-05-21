import { readFile } from 'node:fs/promises'
import path from 'node:path'
import vsctm from 'vscode-textmate'
import oniguruma from 'vscode-oniguruma'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { WritableStream } from 'node:stream/web'

const require = createRequire(import.meta.url)

export interface TokenizeResult {
  lines: TokenizedLine[]
  toString(): string
}

export interface TokenizedLine {
  text: string
  scopes: TokenizedScope[]
}

export interface TokenizedScope {
  name: string
  start: number
  end: number
}

export interface Grammar {
  tokenize(text: string, scope?: string): Promise<TokenizeResult>
}

function tokenizeText(grammar: vsctm.IGrammar, text: string): TokenizeResult {
  let str = ''
  let lines: TokenizedLine[] = []

  str += '\n'

  let results: [string, vsctm.ITokenizeLineResult][] = []

  let ruleStack = vsctm.INITIAL
  for (let line of text.split(/\r\n|\r|\n/g)) {
    let result = grammar.tokenizeLine(line, ruleStack)
    ruleStack = result.ruleStack
    results.push([line, result])
  }

  let maxEndIndex = Math.max(...results.flatMap((r) => r[1].tokens).map((t) => t.endIndex))

  for (let [line, result] of results) {
    let scopes: TokenizedScope[] = []
    lines.push({ text: line, scopes })

    str += line
    str += '\n'

    for (let token of result.tokens) {
      str += ' '.repeat(token.startIndex)
      str += '^'.repeat(token.endIndex - token.startIndex)
      str += ' '.repeat(maxEndIndex - token.endIndex)

      for (let name of token.scopes) {
        str += ' '
        str += name

        scopes.push({
          name,
          start: token.startIndex,
          end: token.endIndex,
        })
      }

      str += '\n'
    }

    str += '\n'
  }

  return {
    lines,
    toString: () => str,
  }
}

let pkgBase = path.join(__dirname, '../syntaxes')
let extBase = path.join(__dirname, '../../vscode-tailwindcss/syntaxes')

const KNOWN_SCOPES = {
  'source.css': {
    file: path.join(pkgBase, 'css.json'),
    inject: [
      'tailwindcss.at-rules.injection',
      'tailwindcss.at-apply.injection',
      'tailwindcss.theme-fn.injection',
      'tailwindcss.screen-fn.injection',
    ],
  },

  'source.css.tailwind': {
    file: path.join(extBase, 'source.css.tailwind.tmLanguage.json'),
    inject: [],
  },

  'tailwindcss.at-apply.injection': {
    file: path.join(extBase, 'at-apply.tmLanguage.json'),
    inject: [],
  },

  'tailwindcss.at-rules.injection': {
    file: path.join(extBase, 'at-rules.tmLanguage.json'),
    inject: [],
  },

  'tailwindcss.theme-fn.injection': {
    file: path.join(extBase, 'theme-fn.tmLanguage.json'),
    inject: [],
  },

  'tailwindcss.screen-fn.injection': {
    file: path.join(extBase, 'screen-fn.tmLanguage.json'),
    inject: [],
  },
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

      let content = await readFile(meta.file, 'utf-8')

      return vsctm.parseRawGrammar(content, path.basename(meta.file))
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
