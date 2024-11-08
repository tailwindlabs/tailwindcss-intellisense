import sift from 'sift-string'

export function closest(input: string, options: string[]): string | undefined {
  return options.concat([]).sort((a, b) => sift(input, a) - sift(input, b))[0]
}

export function distance(a: string, b: string): number {
  return sift(a, b)
}
