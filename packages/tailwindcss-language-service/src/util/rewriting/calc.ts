function parseLength(length: string): [number, string] | null {
  let regex = /^(-?\d*\.?\d+)([a-z%]*)$/i
  let match = length.match(regex)

  if (!match) return null

  let numberPart = parseFloat(match[1])
  if (isNaN(numberPart)) return null

  return [numberPart, match[2]]
}

function round(n: number, precision: number): number {
  return Math.round(n * Math.pow(10, precision)) / Math.pow(10, precision)
}

export function evaluateExpression(str: string): string | null {
  // We're only interested simple calc expressions of the form
  // A + B, A - B, A * B, A / B

  let parts = str.split(/\s+([+*/-])\s+/)

  if (parts.length === 1) return null
  if (parts.length !== 3) return null

  let a = parseLength(parts[0])
  let b = parseLength(parts[2])

  // Not parsable
  if (!a || !b) {
    return null
  }

  // Addition and subtraction require the same units
  if ((parts[1] === '+' || parts[1] === '-') && a[1] !== b[1]) {
    return null
  }

  // Multiplication and division require at least one unit to be empty
  if ((parts[1] === '*' || parts[1] === '/') && a[1] !== '' && b[1] !== '') {
    return null
  }

  switch (parts[1]) {
    case '+':
      return round(a[0] + b[0], 4).toString() + a[1]
    case '*':
      return round(a[0] * b[0], 4).toString() + a[1]
    case '-':
      return round(a[0] - b[0], 4).toString() + a[1]
    case '/':
      return round(a[0] / b[0], 4).toString() + a[1]
  }

  return null
}
