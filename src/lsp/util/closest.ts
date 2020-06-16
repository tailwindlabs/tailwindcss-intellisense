import levenshtein from 'js-levenshtein'

export function closest(input: string, options: string[]): string | undefined {
  return options.sort(
    (a, b) => levenshtein(input, a) - levenshtein(input, b)
  )[0]
}
