export function bigSign(value: bigint) {
  return Number(value > 0n) - Number(value < 0n)
}
