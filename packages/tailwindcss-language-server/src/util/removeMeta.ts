import isObject from './isObject'

export default function removeMeta(obj: any): any {
  let result = {}
  for (let key in obj) {
    if (isObject(obj[key])) {
      result[key] = removeMeta(obj[key])
    } else if (key.substr(0, 2) !== '__') {
      result[key] = obj[key]
    }
  }
  return result
}
