import MultiRegexp from 'multi-regexp2'

export function createMultiRegexp(regexString: string) {
  let insideCharClass = false
  let captureGroupIndex = -1

  for (let i = 0; i < regexString.length; i++) {
    if (
      !insideCharClass &&
      regexString[i] === '[' &&
      regexString[i - 1] !== '\\'
    ) {
      insideCharClass = true
    } else if (
      insideCharClass &&
      regexString[i] === ']' &&
      regexString[i - 1] !== '\\'
    ) {
      insideCharClass = false
    } else if (
      !insideCharClass &&
      regexString[i] === '(' &&
      regexString.substr(i + 1, 2) !== '?:'
    ) {
      captureGroupIndex = i
      break
    }
  }

  const re = /(?:[^\\]|^)\(\?:/g
  let match: RegExpExecArray
  let nonCaptureGroupIndexes: number[] = []

  while ((match = re.exec(regexString)) !== null) {
    if (match[0].startsWith('(')) {
      nonCaptureGroupIndexes.push(match.index)
    } else {
      nonCaptureGroupIndexes.push(match.index + 1)
    }
  }

  const regex = new MultiRegexp(
    new RegExp(
      regexString.replace(re, (m) => m.substr(0, m.length - 2)),
      'g'
    )
  )

  let groupIndex =
    1 + nonCaptureGroupIndexes.filter((i) => i < captureGroupIndex).length

  return {
    exec: (str: string) => {
      return regex.execForGroup(str, groupIndex)
    },
  }
}
