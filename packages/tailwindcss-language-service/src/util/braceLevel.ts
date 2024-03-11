export default function braceLevel(text: string) {
  let count = 0

  for (let i = text.length - 1; i >= 0; i--) {
    let char = text.charCodeAt(i)

    count += Number(char === 0x7b /* { */) - Number(char === 0x7d /* } */)
  }

  return count
}
