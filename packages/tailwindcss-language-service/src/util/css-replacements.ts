/**
 * Any item in the CSS string which may be analyzed and optionally replaced
 */
export type CssNode = CalcExpression | CssVariable

/**
 * A calc(…) expression in a CSS value
 */
export interface CalcExpression {
  kind: 'calc-expression'
  offset: OffsetRange
  parts: string[]
}

/**
 * A var(…) expression which may have an optional fallback value
 */
export interface CssVariable {
  kind: 'css-variable'
  offset: OffsetRange
  name: string
  fallback: string | null
}

export interface OffsetRange {
  /** The zero-based offset where this node starts */
  start: number

  /** The zero-based offset where this node ends */
  end: number
}
