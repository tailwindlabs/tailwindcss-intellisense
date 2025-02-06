interface Throughput {
  rate: number
  elapsed: bigint
  toString(): string
}

export function computeThroughput(
  iterations: number,
  memoryBaseline: number,
  cb: () => void,
): Throughput {
  let start = process.hrtime.bigint()
  for (let i = 0; i < iterations; i++) {
    cb()
  }
  let elapsed = process.hrtime.bigint() - start
  let memorySize = iterations * memoryBaseline

  let rate = Number(memorySize) / (Number(elapsed) / 1e9)

  return {
    rate,
    elapsed,
    toString() {
      return `${formatByteSize(rate)}/s over ${Number(elapsed) / 1e9}s`
    },
  }
}

function formatByteSize(size: number): string {
  let units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']
  let unit = 1000
  let i = 0
  while (size > unit) {
    size /= unit
    i++
  }

  return `${size.toFixed(2)} ${units[i]}`
}
