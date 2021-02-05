export function remToPx(
  value: string,
  rootSize: number = 16
): string | undefined {
  if (/^-?[0-9.]+rem$/.test(value)) {
    let number = parseFloat(value.substr(0, value.length - 3))
    if (!isNaN(number)) {
      return `${number * rootSize}px`
    }
  }
  return undefined
}
