const UNITS = ['byte', 'kilobyte', 'megabyte', 'gigabyte', 'terabyte', 'petabyte']

export function formatBytes(n: number): string {
  let i = n == 0 ? 0 : Math.floor(Math.log(n) / Math.log(1000))
  return new Intl.NumberFormat('en', {
    notation: 'compact',
    style: 'unit',
    unit: UNITS[i],
    unitDisplay: 'narrow',
  }).format(n / 1000 ** i)
}
