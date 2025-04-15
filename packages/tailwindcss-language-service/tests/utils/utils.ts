import dedent from 'dedent'

export const js = dedent
export const css = dedent
export const html = dedent

export const range = (startLine: number, startCol: number, endLine: number, endCol: number) => ({
  start: { line: startLine, character: startCol },
  end: { line: endLine, character: endCol },
})

export const rgb = (red: number, green: number, blue: number, alpha: number = 1) => ({
  red,
  green,
  blue,
  alpha,
})
