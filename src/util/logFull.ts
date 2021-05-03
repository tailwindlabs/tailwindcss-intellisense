import * as util from 'util'

export function logFull(object: any): void {
  console.log(util.inspect(object, { showHidden: false, depth: null }))
}
