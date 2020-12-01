export function remToPx(
  value: string,
  rootSize: number = 16
): string | undefined {
  return /^-?[0-9.]+rem$/.test(value)
    ? `${parseFloat(value.substr(0, value.length - 3)) * rootSize}px`
    : undefined
}
