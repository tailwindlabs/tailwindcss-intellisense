// https://github.com/lodash/lodash/blob/4.17.15/lodash.js#L6735-L6744
let rePropName = /[^.[\]]+|\[(?:(-?\d+(?:\.\d+)?)|(["'])((?:(?!\2)[^\\]|\\.)*?)\2)\]|(?=(?:\.|\[\])(?:\.|\[\]|$))/g
let reEscapeChar = /\\(\\)?/g

export function stringToPath(string: string): string[] {
  let result: string[] = []
  if (string.charCodeAt(0) === 46 /* . */) {
    result.push('')
  }
  // @ts-ignore
  string.replace(rePropName, (match, number, quote, subString) => {
    result.push(quote ? subString.replace(reEscapeChar, '$1') : number || match)
  })
  return result
}
