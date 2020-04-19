export function isObject(variable: any): boolean {
  return Object.prototype.toString.call(variable) === '[object Object]'
}
