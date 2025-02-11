import type { Span } from '../util/state'

/**
 * Text that may be interpreted as a particular kind of document
 *
 * Examples:
 * - `html`: HTML, Vue, Angular, Svlete, etc…
 * - `css`: CSS, SCSS, Less, Stylus, etc…
 * - `js`: JS, JSX, TS, TSX, etc…
 - - `other`: Any other, unknown language
 */
export interface ScopeContext {
  kind: 'context'
  children: AnyScope[]

  meta: {
    /*
     * A high-level description of the tsyntax this language uses
     *
     * - `html`: An HTML-like language
     *
     * Examples:
     * - HTML
     * - Angular
     * - Vue
     * - Svelte
     *
     * - `css`: A CSS-like language
     *
     * Examples:
     * - CSS
     * - SCSS
     * - Less
     * - Sass
     * - Stylus
     *
     * - `js`: A JavaScript-like language
     *
     * These share a lot of similarities with HTML-like languages but contain
     * additional syntax which can be used to embed other languages within them.
     *
     * Examples:
     * - JavaScript / JSX
     * - TypeScript / TSX
     *
     * - `other`: Any other, unknown language syntax
     *
     * Languages that do not fit into the above categories are mostly ignored
     * by the language server and treated as plain text. Detecting classes in a
     * language like this only works for custom patterns.
     */
    syntax: 'html' | 'css' | 'js' | 'other'

    /**
     * The specific language contained within this text. This may be an identifier
     * provided to the language server by the client or it may be inferred from
     * the text itself in the case of embedded languages.
     */
    lang: string
  }

  source: {
    scope: Span
  }
}

export type AnyScope =
  | ScopeContext
