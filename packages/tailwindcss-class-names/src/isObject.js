export function isObject(thing) {
  return Object.prototype.toString.call(thing) === '[object Object]'
}
