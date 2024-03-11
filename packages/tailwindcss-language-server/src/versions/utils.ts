export function bigSign(bigIntValue: bigint) {
  return Number(bigIntValue > 0n) - Number(bigIntValue < 0n)
}
