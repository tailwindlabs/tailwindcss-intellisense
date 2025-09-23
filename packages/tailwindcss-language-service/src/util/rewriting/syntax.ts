import * as parser from '@csstools/css-parser-algorithms'
import * as tokenizer from '@csstools/css-tokenizer'
import { DefaultMap } from '../default-map'
import { CSSToken } from '@csstools/css-tokenizer'

export interface CssSyntax {
  tokens(css: string): tokenizer.CSSToken[]
  component(css: string): parser.ComponentValue | undefined
  components(css: string): parser.ComponentValue[]
  componentsFromTokens(css: CSSToken[]): parser.ComponentValue[]
  componentLists(css: string): parser.ComponentValue[][]
  componentListsFromTokens(css: CSSToken[]): parser.ComponentValue[][]

  tokensToString(tokens: tokenizer.CSSToken[]): string
  componentsToString(values: parser.ComponentValue[]): string
  componentListsToString(values: parser.ComponentValue[][]): string
}

export function createCssSyntax(): CssSyntax {
  let tokens = new DefaultMap((css) => tokenizer.tokenize({ css }))
  let component = new DefaultMap((css) => parser.parseComponentValue(tokens.get(css)))
  let components = new DefaultMap((css) => parser.parseListOfComponentValues(tokens.get(css)))
  let componentLists = new DefaultMap((css) =>
    parser.parseCommaSeparatedListOfComponentValues(tokens.get(css)),
  )

  return {
    // Tokenization
    tokens: (css) => tokens.get(css),
    tokensToString: (tokens) => tokenizer.stringify(...tokens),

    // Parsing CSS syntax
    component: (css) => component.get(css),

    components: (css) => components.get(css),
    componentsFromTokens: (tokens) => parser.parseListOfComponentValues(tokens),
    componentsToString: (values) => parser.stringify([values]),

    componentLists: (css) => componentLists.get(css),
    componentListsFromTokens: (tokens) => parser.parseCommaSeparatedListOfComponentValues(tokens),
    componentListsToString: (lists) => parser.stringify(lists),
  }
}
