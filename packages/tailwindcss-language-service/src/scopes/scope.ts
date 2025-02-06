import type { Span } from '../util/state'

export type ScopeKind =
  // Marks a span of text as being a specific kind of text
  // For example,
  // - `context.html` marks a span of text as being HTML
  // - `context.js` marks a span of text as being JavaScript / JSX
  // - `context.css` marks a span of text as being CSS
  | 'context.html'
  | 'context.js'
  | 'context.css'

  // Marks a span of text that may contain one or more classes in a space-separated list
  // <div class="bg-blue-500 text-white">
  //             ^^^^^^^^^^^^^^^^^^^^^^
  // @apply bg-blue-500 text-white;
  //        ^^^^^^^^^^^^^^^^^^^^^^
  | 'class.list'

  // Marks a span of text that represents a single class
  // <div class="bg-blue-500 text-white">
  //             ^^^^^^^^^^^ ^^^^^^^^^^
  // @apply bg-blue-500 text-white;
  //        ^^^^^^^^^^^ ^^^^^^^^^^
  | 'class.name'

  // Marks the name of an at-rule
  // @media (min-width: 600px) { ... }
  // ^^^^^^
  | 'css.at-rule.name'

  // Marks the parameters of an at-rule
  // @media (min-width: 600px) { ... }
  //        ^^^^^^^^^^^^^^^^^^
  | 'css.at-rule.params'

  // Marks the body of an at-rule
  // @media (min-width: 600px) { ... }
  //                            ^^^^^
  | 'css.at-rule.body'

  // Marks the name of a CSS `@utility` directive
  // @utility hero { }
  //          ^^^^
  // @utility hero-* { }
  //          ^^^^
  | 'css.utility.name'

  // Marks the inside of a static utility definition
  // @utility hero { ... }
  //                ^^^^^
  | 'css.utility.static'

  // Marks the inside of a functional utility definition
  // @utility hero-* { ... }
  //                  ^^^^^
  | 'css.utility.functional'

  // Marks the url of an import statement
  // @import "./some-file.css";
  //          ^^^^^^^^^^^^^^^
  // @reference "./some-file.css";
  //             ^^^^^^^^^^^^^^^
  // @import url("./some-file.css");
  //             ^^^^^^^^^^^^^^^^^
  | 'css.import.url'

  // Marks an import statement's source url
  // @import "./some-file.css" source("./foo");
  //                                   ^^^^^
  // @import "./some-file.css" source(none);
  //                                  ^^^^
  | 'css.import.source-url'

  // Marks an import statement's theme option list
  // @import "./some-file.css" theme(inline reference default);
  //                                 ^^^^^^^^^^^^^^^^^^^^^^^^
  | 'css.import.theme-option-list'

  // Marks an import statement's theme option(s)
  // @import "./some-file.css" theme(inline);
  //                                 ^^^^^^
  // @import "./some-file.css" theme(default);
  //                                 ^^^^^^^
  // @import "./some-file.css" reference;
  //                           ^^^^^^^^^
  // @import "./some-file.css" prefix(tw);
  //                           ^^^^^^^^^^
  | 'css.import.theme-option'

  // Marks an import statement's prefix
  // @import "./some-file.css" prefix(tw);
  //                                  ^^
  | 'css.import.prefix'

  // Marks a theme directive's prefix
  // @theme prefix(tw);
  //               ^^
  | 'css.theme.prefix'

/**
 * Represents information about a span of text in a file
 */
export interface Scope {
  /** The kind of scope we represent */
  kind: ScopeKind

  /** The range during which this scope is active, inclusive */
  span: Span
}

/**
 * Represents a collection of scope information about some text
 */
export class Scopes {
  /**
   * This is a sorted list of scopes that are contained within the text
   *
   * The list is sorted in ascending order by the start of the span and then by
   * the end of the span. This allows us to quickly find the scopes that contain
   * a given position in the text by doing a binary search.
   */
  private list: Scope[]

  /**
   * Create a collection of sorted scopes
   */
  constructor(scopes: Scope[]) {
    this.list = scopes.sort((a, z) => a.span[0] - z.span[0] || z.span[1] - a.span[1])
  }

  /**
   * Get all scopes that are active at a given position in the text
   *
   * For example, given this position in some HTML:
   * ```html
   * <div class="bg-blue-500 text-white">
   *                ^
   * ```
   *
   * We know the following scopes are active:
   * - `context.html` [0, 36]
   * - `class.list` [12, 34]
   * - `class.name` [12, 23]
   */
  public at(pos: number): Scope[] {
    return this.between([pos, pos])
  }

  /**
   * Get all scopes that are active for an entire range of text.
   *
   * Note that this does **NOT** include scopes that begin or end within the
   * range since those scopes were not active for all positions in the range.
   *
   * For example, given this range in some HTML:
   * ```html
   * <div class="bg-blue-500 text-white">
   *                 ^^^^^^^^^^^^
   * ```
   *
   * We know the following scopes are active:
   * - `context.html` [0, 36]
   * - `class.list` [12, 34]
   *
   * Notably, `class.name` is not included because while there are `class.name`
   * scopes that are active at the start and end of the range, they are unique
   * scopes and neither are active for the entire range.
   */
  public between(span: Span): Scope[] {
    return this.list.filter((scope) => scope.span[0] <= span[0] && span[1] <= scope.span[1])
  }

  /**
   * Return an ordered list of all scopes applied to the text
   */
  public all(): Scope[] {
    return this.list
  }

  /**
   * Return an ordered list of all scopes applied to the text
   */
  public description(source?: string): string {
    let max = 0
    for (let scope of this.list) {
      max = Math.max(max, scope.span[1])
    }

    let pad = max.toString().length

    let lines = this.list.map((scope) => {
      let range = `${scope.span[0].toString().padStart(pad)}, ${scope.span[1].toString().padStart(pad)}`
      let desc = `[${range}] ${scope.kind}`

      if (source) {
        let slice = source.slice(scope.span[0], scope.span[1])
        if (slice.length > 20) {
          slice = slice.slice(0, 20) + '...'
        }

        slice = slice.replaceAll('\n', '\\n')

        desc += ` "${slice}"`
      }

      return desc
    })

    return `\n${lines.join('\n')}\n`
  }
}
