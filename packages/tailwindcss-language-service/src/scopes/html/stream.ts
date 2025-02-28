import { Span } from '../../util/state'

const QUOTE_SINGLE = "'".charCodeAt(0)
const QUOTE_DOUBLE = '"'.charCodeAt(0)
const QUOTE_TICK = '`'.charCodeAt(0)
const CURLY_OPEN = '{'.charCodeAt(0)
const CURLY_CLOSE = '}'.charCodeAt(0)
const TAG_END = '>'.charCodeAt(0)
const TAG_START = '<'.charCodeAt(0)
const EXCLAIMATION = '!'.charCodeAt(0)
const EQUALS = '='.charCodeAt(0)

const WS_SPACE = ' '.charCodeAt(0)
const WS_TAB = '\t'.charCodeAt(0)
const WS_NEWLINE = '\n'.charCodeAt(0)
const WS_RETURN = '\r'.charCodeAt(0)
const WS_FEED = '\x0C'.charCodeAt(0)

/// Represents a piece of information about a tag in an HTML document
export type Event =
  /// The start of a comment
  /// <!-- comment -->
  /// ^^^^
  | { kind: 'comment-start'; span: Span }

  /// The end of a comment
  /// <!-- comment -->
  ///              ^^^
  | { kind: 'comment-end'; span: Span }

  /// The start of a tag
  /// <script lang="jsx">
  /// ^^^^^^^
  /// </script>
  /// ^^^^^^^^
  | { kind: 'element-start'; span: Span }

  /// The end of an element definition
  /// <script lang="jsx">
  ///                   ^
  /// </script>
  ///         ^
  | { kind: 'element-end'; span: Span }

  /// An attribute name
  /// <script lang="jsx">
  ///         ^^^^
  | { kind: 'attr-name'; span: Span }

  /// An attribute value
  /// <script lang="jsx">
  ///              ^^^^^
  | { kind: 'attr-value'; span: Span }

  /// An attribute value expression
  /// <script lang={"jsx"}>
  ///               ^^^^^
  | { kind: 'attr-expr'; span: Span }

export interface StreamOptions {
  /** The HTML to scan */
  input: string

  /** A character offset noting where `input` starts in the parent document */
  offset: number
}

export function createHtmlStream({ input, offset }: StreamOptions): Iterable<Event> {
  const enum State {
    Idle,
    Attrs,
    Comment,
  }

  let state = State.Idle
  let events: Event[] = []

  next: for (let i = 0; i < input.length; ++i) {
    let char = input.charCodeAt(i)

    if (state === State.Idle) {
      if (char === TAG_START) {
        for (let j = i; j < input.length; ++j) {
          let peek = input.charCodeAt(j)

          if (peek === TAG_END) {
            events.push({ kind: 'element-start', span: [i, j] })
            events.push({ kind: 'element-end', span: [j, j + 1] })
            i = j
            break
          } else if (peek === EXCLAIMATION && input.startsWith('!--', j)) {
            events.push({ kind: 'comment-start', span: [i, j + 3] })
            state = State.Comment
            i = j + 3
            break
          } else if (
            peek === WS_SPACE ||
            peek === WS_TAB ||
            peek === WS_NEWLINE ||
            peek === WS_RETURN ||
            peek === WS_FEED
          ) {
            events.push({ kind: 'element-start', span: [i, j] })
            state = State.Attrs
            i = j
            break
          }
        }
      }
    }

    //
    else if (state === State.Comment) {
      for (let k = i; k < input.length; ++k) {
        if (input.startsWith('-->', k)) {
          events.push({ kind: 'comment-end', span: [k, k + 3] })
          state = State.Idle
          i = k + 2
          break
        }
      }
    }

    //
    else if (state === State.Attrs) {
      if (char === TAG_END) {
        events.push({ kind: 'element-end', span: [i, i + 1] })
        state = State.Idle
        i += 1
        continue
      }

      //
      else if (
        char === WS_SPACE ||
        char === WS_TAB ||
        char === WS_NEWLINE ||
        char === WS_RETURN ||
        char === WS_FEED
      ) {
        continue
      }

      for (let j = i; j < input.length; ++j) {
        let peek = input.charCodeAt(j)

        if (peek === EQUALS) {
          events.push({ kind: 'attr-name', span: [i, j] })
          i = j
          continue next
        }

        //
        else if (peek === TAG_END) {
          events.push({ kind: 'element-end', span: [i, j + 1] })
          state = State.Idle
          i = j + 1
          continue next
        }

        // quoted
        else if (peek === QUOTE_SINGLE) {
          for (let k = j + 1; k < input.length; ++k) {
            let peek = input.charCodeAt(k)
            if (peek === QUOTE_SINGLE) {
              events.push({ kind: 'attr-value', span: [j + 1, k] })
              i = k
              continue next
            }
          }
        } else if (peek === QUOTE_DOUBLE) {
          for (let k = j + 1; k < input.length; ++k) {
            let peek = input.charCodeAt(k)
            if (peek === QUOTE_DOUBLE) {
              events.push({ kind: 'attr-value', span: [j + 1, k] })
              i = k
              continue next
            }
          }
        } else if (peek === QUOTE_TICK) {
          for (let k = j + 1; k < input.length; ++k) {
            let peek = input.charCodeAt(k)
            if (peek === QUOTE_TICK) {
              events.push({ kind: 'attr-value', span: [j + 1, k] })
              i = k
              continue next
            }
          }
        }

        // expressions
        else if (peek === CURLY_OPEN) {
          let depth = 1

          for (let k = j + 1; k < input.length; ++k) {
            let peek = input.charCodeAt(k)
            if (peek === CURLY_OPEN) {
              depth += 1
            } else if (peek === CURLY_CLOSE) {
              depth -= 1

              if (depth === 0) {
                events.push({ kind: 'attr-expr', span: [j + 1, k] })
                i = k
                continue next
              }
            }
          }
        }
      }
    }
  }

  for (let event of events) {
    event.span[0] += offset
    event.span[1] += offset
  }

  return events
}
