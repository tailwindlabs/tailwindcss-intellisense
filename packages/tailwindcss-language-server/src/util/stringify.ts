import removeMeta from './removeMeta'

export function stringifyConfigValue(x: any): string {
  if (typeof x === 'string') return x
  if (typeof x === 'number') return x.toString()
  if (Array.isArray(x)) {
    return x
      .filter((y) => typeof y === 'string')
      .filter(Boolean)
      .join(', ')
  }
  return ''
}

export function stringifyCss(
  obj: any,
  { indent = 0, selector }: { indent?: number; selector?: string } = {}
): string {
  let indentStr = '\t'.repeat(indent)
  if (obj.__decls === true) {
    let before = ''
    let after = ''
    if (selector) {
      before = `${indentStr}${selector} {\n`
      after = `\n${indentStr}}`
      indentStr += '\t'
    }
    return (
      before +
      Object.keys(removeMeta(obj)).reduce((acc, curr, i) => {
        return `${acc}${i === 0 ? '' : '\n'}${indentStr}${curr}: ${obj[curr]};`
      }, '') +
      after
    )
  }
  return Object.keys(removeMeta(obj)).reduce((acc, curr, i) => {
    return `${acc}${i === 0 ? '' : '\n'}${indentStr}${curr} {\n${stringifyCss(
      obj[curr],
      {
        indent: indent + 1,
        selector,
      }
    )}\n${indentStr}}`
  }, '')
}
