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

    /**
     * Whether or not the language uses semicolons
     *
     * This is only relevant for CSS-style languages at the moment
     *
     * TODO: Remove this. We should use information about the language to build
     * the right scope tree meaing this information is relevant when parsing
     * and does not need to be stored in the tree.
     */
    semi: boolean
  }

  source: {
    scope: Span
  }
}

/**
 * Text that should be treated as a comment whether single line or multi-line
 *
 * Examples:
 * ```css
 * /* This is a comment * /
 * ```
 *
 * ```html
 * <!-- This is a comment -->
 * ```
 *
 * ```js
 * // This is a comment
 * /* This is a comment * /
 * ```
 */
export interface ScopeComment {
  kind: 'comment'
  children: AnyScope[]

  source: {
    scope: Span
  }
}

/**
 * Text that represents a class attribute
 *
 * This generally contains a single class list but may contain multiple if the
 * attribute is being interpolated
 *
 * ```
 * <div class="bg-blue-500 text-white">
 *             ^^^^^^^^^^^^^^^^^^^^^^
 * <div class={"bg-blue-500 text-white"}>
 *             ^^^^^^^^^^^^^^^^^^^^^^^^
 * <div class={clsx({"bg-blue-500 text-white":true})}>
 *             ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
 * ```
 */
export interface ScopeClassAttribute {
  kind: 'class.attr'
  children: AnyScope[]

  meta: {
    static: boolean
  }

  source: {
    scope: Span
  }
}

/**
 * Text that may contain one or more classes in a space-separated list
 *
 * ```
 * <div class="bg-blue-500 text-white">
 *             ^^^^^^^^^^^^^^^^^^^^^^
 * @apply bg-blue-500 text-white;
 *        ^^^^^^^^^^^^^^^^^^^^^^
 * ```
 */
export interface ScopeClassList {
  kind: 'class.list'
  children: AnyScope[]

  source: {
    scope: Span
  }
}

/**
 * Text that represents a single class
 *
 * ```
 * <div class="bg-blue-500 text-white">
 *             ^^^^^^^^^^^ ^^^^^^^^^^
 * @apply bg-blue-500 text-white;
 *        ^^^^^^^^^^^ ^^^^^^^^^^
 * ```
 */
export interface ScopeClassName {
  kind: 'class.name'
  children: AnyScope[]

  source: {
    scope: Span
  }
}

/**
 * Represents an at-rule in CSS
 *
 * ```
 * @media (min-width: 600px) { ... }
 * ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
 * @apply bg-blue-500 text-white;
 * ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
 * ```
 */
export interface ScopeAtRule {
  kind: 'css.at-rule'
  children: AnyScope[]

  source: {
    scope: Span

    // Marks the name of an at-rule
    // @media (min-width: 600px) { ... }
    // ^^^^^^
    name: Span

    // Marks the parameters of an at-rule
    // @media (min-width: 600px) { ... }
    //        ^^^^^^^^^^^^^^^^^^
    params: Span

    // Marks the body of an at-rule
    // @media (min-width: 600px) { ... }
    //                            ^^^^^
    body: Span | null
  }
}

/**
 * Text that represents a single class
 *
 * ```
 * @utility hero { ... }
 * ````
 */
export interface ScopeAtUtility {
  kind: 'css.at-rule.utility'
  children: AnyScope[]

  meta: {
    kind: 'static' | 'functional'
  }

  source: {
    scope: Span

    /**
     * The "root" of the utility
     *
     * ```
     * @utility hero { ... }
     *          ^^^^
     * @utility hero-* { ... }
     *          ^^^^
     * ````
     */
    name: Span
  }
}

/**
 * Text that represents a single class
 *
 * ```
 * @import "./some-file.css";
 * ^^^^^^^^^^^^^^^^^^^^^^^^^^
 * ````
 */
export interface ScopeAtImport {
  kind: 'css.at-rule.import'
  children: AnyScope[]

  source: {
    scope: Span

    // Marks the url of an import statement
    // @import "./some-file.css";
    //          ^^^^^^^^^^^^^^^
    // @reference "./some-file.css";
    //             ^^^^^^^^^^^^^^^
    // @import url("./some-file.css");
    //             ^^^^^^^^^^^^^^^^^
    url: Span | null

    // Marks an import statement's source url
    // @import "./some-file.css" source("./foo");
    //                                   ^^^^^
    // @import "./some-file.css" source(none);
    //                                  ^^^^
    sourceUrl: Span | null
  }
}

/**
 * Text that represents an individual theme option
 *
 * ```
 * Marks an import statement's theme option list
 * @import "./some-file.css" theme(inline reference default);
 *                                 ^^^^^^^^^^^^^^^^^^^^^^^^
 * @theme inline default { ... }
 *        ^^^^^^^^^^^^^^
 * ```
 */
export interface ScopeThemeOptionList {
  kind: 'theme.option.list'
  children: AnyScope[]

  source: {
    scope: Span
  }
}

/**
 * Text that represents an individual theme option
 *
 * ```
 * @import "./some-file.css" theme(inline);
 *                                 ^^^^^^
 * @import "./some-file.css" theme(default);
 *                                 ^^^^^^^
 * @import "./some-file.css" reference;
 *                           ^^^^^^^^^
 * @import "./some-file.css" prefix(tw);
 *                           ^^^^^^^^^^
 * @theme inline default;
 *        ^^^^^^ ^^^^^^^
 * @theme prefix(tw);
 *        ^^^^^^^^^^
 * ```
 */
export interface ScopeThemeOptionName {
  kind: 'theme.option.name'
  children: AnyScope[]

  source: {
    scope: Span
  }
}

/**
 * Text that represents an individual theme option
 *
 * ```
 * @import "./some-file.css" prefix(tw);
 *                                  ^^
 * @theme prefix(tw);
 *               ^^
 * ```
 */
export interface ScopeThemePrefix {
  kind: 'theme.prefix'
  children: AnyScope[]

  source: {
    scope: Span
  }
}

export type ScopeKind = keyof ScopeMap
export type Scope<K extends ScopeKind> = ScopeMap[K]
export type AnyScope = ScopeMap[ScopeKind]

type ScopeMap = {
  context: ScopeContext
  comment: ScopeComment
  'class.attr': ScopeClassAttribute
  'class.list': ScopeClassList
  'class.name': ScopeClassName
  'css.at-rule': ScopeAtRule
  'css.at-rule.utility': ScopeAtUtility
  'css.at-rule.import': ScopeAtImport
  'theme.option.list': ScopeThemeOptionList
  'theme.option.name': ScopeThemeOptionName
  'theme.prefix': ScopeThemePrefix
}
