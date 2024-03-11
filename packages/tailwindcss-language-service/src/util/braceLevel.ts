export default function braceLevel(text: string) {
  let count = 0
  for (let i = text.length - 1; i >= 0; i--) {
    switch (text[i]) {
      case '{':
        count += 1
        break
      case '}':
        count -= 1
        break
    }
  }
  return count
}
