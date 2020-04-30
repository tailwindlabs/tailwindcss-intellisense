export function arraysEqual(arr1: any[], arr2: any[]): boolean {
  return (
    JSON.stringify(arr1.concat([]).sort()) ===
    JSON.stringify(arr2.concat([]).sort())
  )
}
